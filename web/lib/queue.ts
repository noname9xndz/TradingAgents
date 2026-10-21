import { queueAdd, queueFinish, queueRemove, queueRequeueRunning, queueTake, queueWaiting } from "./db";
import type { RunSource } from "./history";
import { isRunning, startRun, type RunOutcome } from "./runs";

/** Runs waiting their turn, kept in the queue table: one runs at a time, the next starts when it ends.
 * The running one keeps its row until it ends, so a restart picks it up again. */
export type Queued = { id: string; job: any; source: RunSource; enqueuedAt: number };

const store = globalThis as unknown as {
  tradingOnFinish?: (outcome: RunOutcome, job: any, source: RunSource) => void;
  tradingQueueWorker?: ReturnType<typeof setInterval>;
};

/** Start the next waiting run if nothing is running. */
export function pump() {
  if (isRunning()) return;
  const next = queueTake();
  if (next) startRun(next.job, next.source);
}

/** Add a run; returns 0 when it started at once, else its place in the line. */
export function enqueue(job: any, source: RunSource = { type: "manual" }): number {
  queueAdd(crypto.randomUUID(), job, source);
  pump();
  return queueWaiting().length;
}

export const queued = (): Queued[] => queueWaiting();

export const removeQueued = (id: string) => queueRemove(id);

/** The queue's worker: picks up what a restart left, then keeps the line moving. */
export function startQueueWorker() {
  if (store.tradingQueueWorker) return;
  queueRequeueRunning();
  pump();
  store.tradingQueueWorker = setInterval(() => {
    try {
      pump();
    } catch (err) {
      console.error("Queue worker failed:", err);
    }
  }, 10_000);
}

// When a run ends its row goes; a scheduled run that failed goes back in line while it has retries left.
store.tradingOnFinish = (outcome, job, source) => {
  queueFinish();
  if (outcome === "error" && source.type === "job" && source.attempt < source.retries) {
    queueAdd(crypto.randomUUID(), job, { ...source, attempt: source.attempt + 1 });
  }
  // After the finished run has let go, so isRunning() is false.
  setTimeout(pump, 0);
};
