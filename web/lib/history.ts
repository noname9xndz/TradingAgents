import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Finished runs, one folder each: meta.json for the list, events.jsonl to replay. */
export const HISTORY_DIR =
  process.env.TRADINGAGENTS_WEB_HISTORY || path.join(os.homedir(), ".tradingagents", "web_history");

/** What started a run: a person, or a scheduled job (and which attempt of it). */
export type RunSource = { type: "manual" } | {
      type: "job";
      jobId: string;
      jobName: string;
      fireId?: string; // which time the job went off
      attempt: number;
      retries: number;
    };

export type RunMeta = {
  id: string;
  ticker: string;
  date: string;
  provider: string;
  quick: string;
  deep: string;
  analysts: string[];
  language: string;
  depth: number;
  startedAt: number;
  endedAt: number;
  status: "done" | "error" | "stopped";
  rating?: string;
  reportPath?: string;
  error?: string;
  // Everything that produced the run (cli.web_bridge.run_settings): models per
  // tier, rounds, data vendors, sampling, version.
  settings?: Record<string, unknown>;
  category?: string; // the list the symbol was picked from: stock / crypto / forex
  source?: RunSource;
  // What was asked for, to run it again: the form's values, the endpoint as its origin only.
  request?: Record<string, unknown>;
  usage?: Usage;
};

/** Tokens a run used, overall and per model; reasoning is part of output, cached part of input. */
export type TokenCount = { calls: number; input: number; output: number; reasoning: number; cached: number };
export type Usage = { total: TokenCount; models: Record<string, TokenCount> };

/** A request as it may be kept: a server URL can carry a password, so only its origin stays. */
export function keepableRequest(job: any) {
  let backendUrl: string | undefined;
  try {
    backendUrl = job.backendUrl ? new URL(job.backendUrl).origin + new URL(job.backendUrl).pathname : undefined;
  } catch {
    backendUrl = undefined;
  }
  return { ...job, backendUrl };
}

// Ids are folder names: keep them to characters that cannot leave the folder.
const ID = /^[A-Za-z0-9_.-]+$/;

const usageOf = ({ total, models }: any): Usage => ({ total, models });

export function saveRun(job: any, events: string[], source: RunSource = { type: "manual" }) {
  const parsed = events.map((line) => JSON.parse(line));
  const last = parsed[parsed.length - 1] ?? {};
  const start = parsed.find((e) => e.type === "start") ?? {};
  const startedAt = parsed[0]?.at ?? Date.now();
  const ticker = String(start.ticker ?? job.ticker ?? "").replace(/[^A-Za-z0-9.=^-]/g, "");
  const stamp = new Date(startedAt).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const id = `${stamp}-${ticker.replace(/[^A-Za-z0-9.-]/g, "_")}`;
  const meta: RunMeta = {
    id,
    ticker,
    date: job.date,
    provider: job.provider,
    quick: job.quick,
    deep: job.deep,
    analysts: start.analysts ?? job.analysts,
    language: job.language,
    depth: job.depth,
    startedAt,
    endedAt: last.at ?? Date.now(),
    status: last.type === "done" ? "done" : last.type === "stopped" ? "stopped" : "error",
    rating: last.rating,
    reportPath: last.reportPath,
    error: last.type === "error" ? last.message : undefined,
    settings: start.settings,
    category: start.category ?? job.category,
    source,
    request: keepableRequest(job),
    usage: parsed.findLast((e) => e.type === "usage") ? usageOf(parsed.findLast((e) => e.type === "usage")) : undefined,
  };
  const dir = path.join(HISTORY_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "events.jsonl"), events.join("\n") + "\n", "utf-8");
  writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  return id;
}

export function runEvents(id: string): string | null {
  if (!ID.test(id)) return null;
  try {
    return readFileSync(path.join(HISTORY_DIR, id, "events.jsonl"), "utf-8");
  } catch {
    return null;
  }
}

/** Delete a failed run's folder. Finished runs stay: only an error is thrown away. */
export function deleteFailedRun(id: string): boolean {
  if (!ID.test(id) || id === "." || id === "..") return false;
  const dir = path.join(HISTORY_DIR, id);
  try {
    if (JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf-8")).status !== "error") return false;
  } catch {
    return false;
  }
  rmSync(dir, { recursive: true, force: true });
  return true;
}
