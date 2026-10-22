import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { errorKind } from "./error-kinds";
import { HISTORY_DIR, type RunMeta } from "./history";

/** The web app's database.
 * - ``runs``: an index of the saved runs for fast lookups. The run folders stay the record:
 *   every row is read from them, so these rows can be deleted and rebuilt.
 * - ``jobs``: the scheduled jobs. Here they are the record.
 * - ``job_fires``: each time a job went off, by its schedule or by hand.
 * - ``queue``: runs waiting their turn, and the one running. A row is deleted when its run ends.
 * - ``settings``: the settings page: API keys and defaults. The file is readable by its owner only.
 * - ``errors``: the error log: failed analyses and failures of the server's own parts. */
export const DB_PATH =
  process.env.TRADINGAGENTS_HISTORY_DB || path.join(os.homedir(), ".tradingagents", "history.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  trade_date TEXT,
  provider TEXT,
  quick_model TEXT,
  deep_model TEXT,
  analysts TEXT,
  language TEXT,
  depth INTEGER,
  status TEXT NOT NULL,
  rating TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  report_path TEXT,
  error TEXT,
  decision TEXT,
  settings TEXT,
  category TEXT,
  source TEXT,
  request TEXT,
  job_id TEXT,
  job_name TEXT,
  usage TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  llm_calls INTEGER
);
CREATE INDEX IF NOT EXISTS runs_ticker ON runs (ticker, started_at);
CREATE INDEX IF NOT EXISTS runs_rating ON runs (rating, started_at);
CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  next_run_at INTEGER,
  last_run_at INTEGER,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_fires (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  fired_at INTEGER NOT NULL,
  trigger TEXT NOT NULL,
  symbols TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS job_fires_at ON job_fires (fired_at);
CREATE TABLE IF NOT EXISTS queue (
  id TEXT PRIMARY KEY,
  enqueued_at INTEGER NOT NULL,
  state TEXT NOT NULL, -- waiting / running
  ticker TEXT NOT NULL,
  job TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  scope TEXT NOT NULL, -- run / scheduler / queue / history / telegram
  kind TEXT NOT NULL, -- lib/error-kinds.ts
  message TEXT NOT NULL,
  detail TEXT,
  run_id TEXT,
  ticker TEXT,
  job_id TEXT,
  job_name TEXT
);
CREATE INDEX IF NOT EXISTS errors_at ON errors (at);
`;

// Columns added after the first schema, for databases made before them.
const ADDED_COLUMNS: [string, string][] = [
  ["settings", "TEXT"],
  ["category", "TEXT"],
  ["source", "TEXT"],
  ["request", "TEXT"],
  ["job_id", "TEXT"],
  ["job_name", "TEXT"],
  ["usage", "TEXT"],
  ["tokens_in", "INTEGER"],
  ["tokens_out", "INTEGER"],
  ["llm_calls", "INTEGER"],
];

// On globalThis so the dev server's module reloads keep one connection.
const store = globalThis as unknown as { tradingDb?: DatabaseSync };

// Once per load of this module, so a schema change reaches a connection kept open across reloads.
let ready = false;

function db(): DatabaseSync {
  if (!store.tradingDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    store.tradingDb = new DatabaseSync(DB_PATH);
    // It holds API keys.
    try {
      chmodSync(DB_PATH, 0o600);
    } catch {}
  }
  const conn = store.tradingDb;
  if (!ready) {
    conn.exec(SCHEMA);
    // A database made before a column existed gets it, then its rows are read again from the folders.
    const columns = (conn.prepare("PRAGMA table_info(runs)").all() as { name: string }[]).map((c) => c.name);
    const missing = ADDED_COLUMNS.filter(([name]) => !columns.includes(name));
    for (const [name, type] of missing) conn.exec(`ALTER TABLE runs ADD COLUMN ${name} ${type}`);
    if (missing.length) conn.exec("DELETE FROM runs");
    syncAll(conn);
    backfillErrors(conn);
    ready = true;
  }
  return conn;
}

/** Insert or refresh one run's row from its folder. */
function indexFrom(conn: DatabaseSync, id: string) {
  const dir = path.join(HISTORY_DIR, id);
  const meta: RunMeta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf-8"));
  let decision: string | null = null;
  try {
    const lines = readFileSync(path.join(dir, "events.jsonl"), "utf-8").trim().split("\n");
    const done = JSON.parse(lines[lines.length - 1]);
    decision = done.type === "done" ? (done.sections?.final_trade_decision ?? null) : null;
  } catch {
    // A run without readable events still has its meta.
  }
  conn
    .prepare(
      `INSERT OR REPLACE INTO runs (id, ticker, trade_date, provider, quick_model, deep_model, analysts,
         language, depth, status, rating, started_at, ended_at, report_path, error, decision, settings, category,
         source, request, job_id, job_name, usage, tokens_in, tokens_out, llm_calls)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      meta.id, meta.ticker, meta.date ?? null, meta.provider ?? null, meta.quick ?? null, meta.deep ?? null,
      JSON.stringify(meta.analysts ?? []), meta.language ?? null, meta.depth ?? null, meta.status,
      meta.rating ?? null, meta.startedAt, meta.endedAt ?? null, meta.reportPath ?? null, meta.error ?? null,
      decision,
      meta.settings ? JSON.stringify(meta.settings) : null,
      meta.category ?? null,
      meta.source ? JSON.stringify(meta.source) : null,
      meta.request ? JSON.stringify(meta.request) : null,
      meta.source?.type === "job" ? meta.source.jobId : null,
      meta.source?.type === "job" ? meta.source.jobName : null,
      meta.usage ? JSON.stringify(meta.usage) : null,
      meta.usage?.total.input ?? null,
      meta.usage?.total.output ?? null,
      meta.usage?.total.calls ?? null,
    );
}

/** Index every saved folder the database does not have yet, e.g. after the
 * database was deleted or the folders were copied in from elsewhere. */
function syncAll(conn: DatabaseSync) {
  let ids: string[] = [];
  try {
    ids = readdirSync(HISTORY_DIR);
  } catch {
    return;
  }
  const known = new Set((conn.prepare("SELECT id FROM runs").all() as { id: string }[]).map((r) => r.id));
  for (const id of ids) {
    if (known.has(id)) continue;
    try {
      indexFrom(conn, id);
    } catch (err) {
      console.error(`Could not index saved run ${id}:`, err);
    }
  }
}

export const indexRun = (id: string) => indexFrom(db(), id);

export const unindexRun = (id: string) => db().prepare("DELETE FROM runs WHERE id = ?").run(id);

export type RunFilter = {
  id?: string;
  category?: string; // stock / crypto / forex
  source?: string; // "manual", or a job's id
  ticker?: string;
  rating?: string; // a rating, or "stopped" / "error" for runs that did not finish
  provider?: string;
  model?: string; // either tier's model
  analyst?: string;
  from?: string; // analysis date, YYYY-MM-DD, inclusive
  to?: string;
  page?: number; // from 1
  pageSize?: number;
};

export type RunPage = { runs: RunMeta[]; total: number; page: number; pageSize: number };

export function queryRuns(f: RunFilter): RunPage {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const add = (clause: string, ...values: (string | number)[]) => {
    where.push(clause);
    args.push(...values);
  };
  if (f.id) add("id = ?", f.id);
  if (f.category) add("category = ?", f.category);
  if (f.source === "manual") add("job_id IS NULL");
  else if (f.source) add("job_id = ?", f.source);
  if (f.ticker) add("ticker LIKE ?", `%${f.ticker.toUpperCase().replace("/", "")}%`);
  if (f.rating) add(f.rating === "error" || f.rating === "stopped" ? "status = ?" : "rating = ?", f.rating);
  if (f.provider) add("provider = ?", f.provider);
  if (f.model) add("(quick_model LIKE ? OR deep_model LIKE ?)", `%${f.model}%`, `%${f.model}%`);
  if (f.analyst) add("EXISTS (SELECT 1 FROM json_each(runs.analysts) WHERE value = ?)", f.analyst);
  if (f.from) add("trade_date >= ?", f.from);
  if (f.to) add("trade_date <= ?", f.to);
  const filter = where.length ? "WHERE " + where.join(" AND ") : "";
  const pageSize = Math.min(Math.max(f.pageSize ?? 20, 1), 100);
  const page = Math.max(f.page ?? 1, 1);

  const conn = db();
  const { total } = conn.prepare(`SELECT COUNT(*) AS total FROM runs ${filter}`).get(...args) as { total: number };
  const rows = conn
    .prepare(`SELECT * FROM runs ${filter} ORDER BY started_at DESC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, (page - 1) * pageSize) as Record<string, any>[];
  const runs = rows.map((r) => ({
    id: r.id,
    ticker: r.ticker,
    date: r.trade_date,
    provider: r.provider,
    quick: r.quick_model,
    deep: r.deep_model,
    analysts: JSON.parse(r.analysts || "[]"),
    language: r.language,
    depth: r.depth,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    status: r.status,
    rating: r.rating ?? undefined,
    reportPath: r.report_path ?? undefined,
    error: r.error ?? undefined,
    settings: r.settings ? JSON.parse(r.settings) : undefined,
    category: r.category ?? undefined,
    source: r.source ? JSON.parse(r.source) : undefined,
    request: r.request ? JSON.parse(r.request) : undefined,
    usage: r.usage ? JSON.parse(r.usage) : undefined,
  }));
  return { runs, total, page, pageSize };
}

/** The values the filters can offer: providers and models seen so far. */
export function filterChoices() {
  const conn = db();
  const column = (sql: string) => (conn.prepare(sql).all() as { v: string }[]).map((r) => r.v).filter(Boolean);
  return {
    providers: column("SELECT DISTINCT provider AS v FROM runs ORDER BY v"),
    models: column("SELECT DISTINCT quick_model AS v FROM runs UNION SELECT DISTINCT deep_model FROM runs ORDER BY v"),
    jobs: conn.prepare("SELECT DISTINCT job_id AS id, job_name AS name FROM runs WHERE job_id IS NOT NULL ORDER BY job_name").all() as {
      id: string;
      name: string;
    }[],
  };
}

// --- Scheduled jobs: stored whole in ``data``, with the columns the scheduler reads. ---

/** Jobs saved before they moved here, in web_jobs.json, are imported once and the file set aside. */
function importOldJobs(conn: DatabaseSync) {
  const file = path.join(path.dirname(DB_PATH), "web_jobs.json");
  let old: any[] = [];
  try {
    old = JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return;
  }
  for (const job of old) putJob(job, conn);
  renameSync(file, `${file}.imported`);
}

let jobsReady = false;
function jobsDb(): DatabaseSync {
  const conn = db();
  if (!jobsReady) {
    importOldJobs(conn);
    jobsReady = true;
  }
  return conn;
}

export function listJobs<T>(): T[] {
  return (jobsDb().prepare("SELECT data FROM jobs ORDER BY created_at").all() as { data: string }[]).map((r) =>
    JSON.parse(r.data),
  );
}

export function putJob(
  job: { id: string; name: string; enabled: boolean; nextRunAt?: number | null; lastRunAt?: number; createdAt: number },
  conn: DatabaseSync = jobsDb(),
) {
  conn
    .prepare(
      `INSERT OR REPLACE INTO jobs (id, name, enabled, next_run_at, last_run_at, created_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(job.id, job.name, job.enabled ? 1 : 0, job.nextRunAt ?? null, job.lastRunAt ?? null, job.createdAt, JSON.stringify(job));
}

export function removeJob(id: string) {
  jobsDb().prepare("DELETE FROM jobs WHERE id = ?").run(id);
}

// --- When jobs went off, and the runs each time started. ---

export type Fire = { id: string; jobId: string; jobName: string; firedAt: number; trigger: "schedule" | "manual"; symbols: string[] };
export type FireRun = { id: string; ticker: string; status: string; rating: string | null; attempt: number; fireId: string };

export function logFire(fire: Fire) {
  db()
    .prepare("INSERT INTO job_fires (id, job_id, job_name, fired_at, trigger, symbols) VALUES (?, ?, ?, ?, ?, ?)")
    .run(fire.id, fire.jobId, fire.jobName, fire.firedAt, fire.trigger, JSON.stringify(fire.symbols));
}

/** The latest times jobs went off, newest first, with the saved runs of each. */
export function listFires(limit = 30): { fires: Fire[]; runs: FireRun[] } {
  const conn = db();
  const fires = (conn.prepare("SELECT * FROM job_fires ORDER BY fired_at DESC LIMIT ?").all(limit) as any[]).map((r) => ({
    id: r.id,
    jobId: r.job_id,
    jobName: r.job_name,
    firedAt: r.fired_at,
    trigger: r.trigger,
    symbols: JSON.parse(r.symbols),
  }));
  if (!fires.length) return { fires, runs: [] };
  const runs = conn
    .prepare(
      `SELECT id, ticker, status, rating, json_extract(source, '$.attempt') AS attempt, json_extract(source, '$.fireId') AS fireId
       FROM runs WHERE json_extract(source, '$.fireId') IN (${fires.map(() => "?").join(",")}) ORDER BY started_at`,
    )
    .all(...fires.map((f) => f.id)) as FireRun[];
  return { fires, runs };
}

// --- The run queue: oldest first; one row at a time is ``running``. ---

export type QueueRow = { id: string; job: any; source: any; enqueuedAt: number; state: "waiting" | "running" };

const queueRow = (r: any): QueueRow => ({ id: r.id, job: JSON.parse(r.job), source: JSON.parse(r.source), enqueuedAt: r.enqueued_at, state: r.state });

export function queueAdd(id: string, job: any, source: any) {
  db()
    .prepare("INSERT INTO queue (id, enqueued_at, state, ticker, job, source) VALUES (?, ?, 'waiting', ?, ?, ?)")
    .run(id, Date.now(), String(job.ticker ?? ""), JSON.stringify(job), JSON.stringify(source));
}

export const queueWaiting = (): QueueRow[] =>
  (db().prepare("SELECT * FROM queue WHERE state = 'waiting' ORDER BY enqueued_at, rowid").all() as any[]).map(queueRow);

/** The oldest waiting row, now marked running. */
export function queueTake(): QueueRow | undefined {
  const next = queueWaiting()[0];
  if (next) db().prepare("UPDATE queue SET state = 'running' WHERE id = ?").run(next.id);
  return next;
}

export const queueRemove = (id: string) => db().prepare("DELETE FROM queue WHERE id = ? AND state = 'waiting'").run(id);
export const queueFinish = () => db().prepare("DELETE FROM queue WHERE state = 'running'").run();
/** After a restart nothing is running: a row left "running" was cut off and goes first in line again. */
export const queueRequeueRunning = () => db().prepare("UPDATE queue SET state = 'waiting' WHERE state = 'running'").run();

// --- Settings: one JSON value per name. ---

/** Settings saved before they moved here, in web_settings.json, are imported once and the file set aside. */
let settingsReady = false;
function settingsDb(): DatabaseSync {
  const conn = db();
  if (!settingsReady) {
    const file = process.env.TRADINGAGENTS_WEB_SETTINGS || path.join(path.dirname(DB_PATH), "web_settings.json");
    try {
      const old = JSON.parse(readFileSync(file, "utf-8"));
      for (const name of ["keys", "defaults"]) if (old[name]) putSetting(name, old[name], conn);
      renameSync(file, `${file}.imported`);
    } catch {
      // No old file.
    }
    settingsReady = true;
  }
  return conn;
}

export function getSetting<T>(name: string, fallback: T): T {
  const row = settingsDb().prepare("SELECT value FROM settings WHERE name = ?").get(name) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : fallback;
}

export function putSetting(name: string, value: unknown, conn: DatabaseSync = settingsDb()) {
  conn.prepare("INSERT OR REPLACE INTO settings (name, value) VALUES (?, ?)").run(name, JSON.stringify(value));
}

// --- The error log. ---

export type ErrorRow = {
  id: number;
  at: number;
  scope: string;
  kind: string;
  message: string;
  detail?: string | null;
  runId?: string | null;
  ticker?: string | null;
  jobId?: string | null;
  jobName?: string | null;
};

export function insertError(e: Omit<ErrorRow, "id">, conn: DatabaseSync = db()) {
  conn
    .prepare("INSERT INTO errors (at, scope, kind, message, detail, run_id, ticker, job_id, job_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(e.at, e.scope, e.kind, e.message, e.detail ?? null, e.runId ?? null, e.ticker ?? null, e.jobId ?? null, e.jobName ?? null);
}

/** Failed runs saved before the log existed go in once. */
function backfillErrors(conn: DatabaseSync) {
  if (conn.prepare("SELECT 1 FROM settings WHERE name = 'errors_backfilled'").get()) return;
  const failed = conn.prepare("SELECT id, ticker, error, ended_at, started_at, job_id, job_name FROM runs WHERE status = 'error'").all() as any[];
  for (const r of failed) {
    const message = r.error ?? "Lỗi không rõ";
    insertError(
      { at: r.ended_at ?? r.started_at, scope: "run", kind: errorKind(message), message, runId: r.id, ticker: r.ticker, jobId: r.job_id, jobName: r.job_name },
      conn,
    );
  }
  conn.prepare("INSERT OR REPLACE INTO settings (name, value) VALUES ('errors_backfilled', 'true')").run();
}

export type ErrorFilter = { scope?: string; kind?: string; from?: number; page?: number; pageSize?: number };

/** The log, newest first, a page at a time. */
export function queryErrors(f: ErrorFilter) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.scope) where.push("scope = ?"), args.push(f.scope);
  if (f.kind) where.push("kind = ?"), args.push(f.kind);
  if (f.from) where.push("at >= ?"), args.push(f.from);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const conn = db();
  const total = (conn.prepare(`SELECT COUNT(*) AS n FROM errors ${clause}`).get(...args) as { n: number }).n;
  const rows = conn
    .prepare(
      `SELECT id, at, scope, kind, message, detail, run_id AS runId, ticker, job_id AS jobId, job_name AS jobName
       FROM errors ${clause} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, (page - 1) * pageSize) as ErrorRow[];
  return { errors: rows, total, page, pageSize };
}

export const countErrorsSince = (since: number) => (db().prepare("SELECT COUNT(*) AS n FROM errors WHERE at >= ?").get(since) as { n: number }).n;

export const clearErrors = () => db().exec("DELETE FROM errors");
