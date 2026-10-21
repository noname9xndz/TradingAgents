import { listFires, listJobs, logFire, putJob, removeJob } from "./db";
import { enqueue, queued } from "./queue";
import { currentRun, isRunning } from "./runs";
import { nextRun, tradeDate, type Schedule } from "./schedule";

/** Scheduled analyses: which symbols, with which settings, when. Stored in the jobs table (lib/db.ts). */

/** A failed symbol is run again at most this many times. */
export const MAX_RETRIES = 3;

export type Job = {
  id: string;
  name: string;
  enabled: boolean;
  symbols: { category: string; ticker: string }[];
  request: {
    analysts: string[];
    language: string;
    depth: number;
    provider: string;
    quick: string;
    deep: string;
    backendUrl?: string;
  };
  schedule: Schedule;
  retries: number; // times a failed symbol is run again
  createdAt: number;
  lastRunAt?: number;
  nextRunAt?: number | null;
};

export const readJobs = () => listJobs<Job>();

const plan = (job: Job, now = new Date()): Job => ({
  ...job,
  nextRunAt: job.enabled ? (nextRun(job.schedule, now, job.lastRunAt ? new Date(job.lastRunAt) : undefined)?.getTime() ?? null) : null,
});

/** Create or replace a job; its next run is worked out from its schedule. */
export function saveJob(input: Omit<Job, "id" | "createdAt"> & { id?: string }): Job {
  const existing = readJobs().find((j) => j.id === input.id);
  const job = plan({
    ...existing,
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? Date.now(),
    retries: Math.min(Math.max(Math.round(input.retries ?? 0), 0), MAX_RETRIES),
  } as Job);
  putJob(job);
  return job;
}

export const deleteJob = (id: string) => removeJob(id);

/** Put every symbol of the job in line, dated today, and log that the job went off. */
export function runJob(job: Job, now = new Date(), trigger: "schedule" | "manual" = "manual") {
  const fireId = crypto.randomUUID();
  logFire({ id: fireId, jobId: job.id, jobName: job.name, firedAt: now.getTime(), trigger, symbols: job.symbols.map((s) => s.ticker) });
  for (const { category, ticker } of job.symbols) {
    enqueue(
      { ...job.request, ticker, category, date: tradeDate(now) },
      { type: "job", jobId: job.id, jobName: job.name, fireId, attempt: 0, retries: job.retries },
    );
  }
}

/** Each symbol's state for one firing: its last saved run, or still running / waiting, or "dropped"
 * (it never ran, e.g. the server restarted while it waited). */
export function jobHistory(limit = 30) {
  const { fires, runs } = listFires(limit);
  const waiting = queued();
  const live = isRunning() ? currentRun() : undefined;
  return fires.map((fire) => ({
    ...fire,
    symbols: fire.symbols.map((ticker) => {
      const mine = (s: any) => s?.type === "job" && s.fireId === fire.id;
      const run = runs.filter((r) => r.fireId === fire.id && r.ticker === ticker).at(-1);
      // A failed symbol waiting for its retry shows as waiting, not failed.
      if (live && mine(live.source) && live.job.ticker === ticker) return { ticker, status: "running", attempt: (live.source as any).attempt };
      const next = waiting.find((q) => mine(q.source) && q.job.ticker === ticker);
      if (next) return { ticker, status: "queued", attempt: (next.source as any).attempt };
      return run ? { ticker, status: run.status, rating: run.rating, runId: run.id, attempt: run.attempt } : { ticker, status: "dropped" };
    }),
  }));
}

/** Run the jobs that are due, then work out when each runs next. A "once" job turns itself off. */
export function tick(now = new Date()) {
  for (const job of readJobs()) {
    if (!job.enabled || !job.nextRunAt || job.nextRunAt > now.getTime()) continue;
    runJob(job, now, "schedule");
    putJob(plan({ ...job, lastRunAt: now.getTime(), enabled: job.schedule.type !== "once" }, now));
  }
}

const store = globalThis as unknown as { tradingScheduler?: ReturnType<typeof setInterval> };

/** Check the schedule every 30 seconds while the server runs. Missed runs are not made up. */
export function startScheduler() {
  if (store.tradingScheduler) return;
  // Runs whose time passed while the server was off are skipped: plan from now.
  for (const job of readJobs()) if (job.nextRunAt && job.nextRunAt < Date.now()) putJob(plan(job));
  store.tradingScheduler = setInterval(() => {
    try {
      tick();
    } catch (err) {
      console.error("Scheduler tick failed:", err);
    }
  }, 30_000);
}
