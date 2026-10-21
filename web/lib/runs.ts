import type { ChildProcess } from "node:child_process";
import { bridge, errorLine } from "./bridge";
import { indexRun } from "./db";
import { saveRun, type RunSource } from "./history";

/** The run in progress (or the last one), kept on the server so a page that
 * reloads can attach to it again instead of losing it. One at a time: this is
 * a tool for one person on their own machine. */
type Run = {
  events: string[]; // every line the bridge wrote, stamped with when it arrived
  listeners: Set<(line: string) => void>;
  child: ChildProcess;
  finished: boolean;
  job: any;
  source: RunSource;
};

export type RunOutcome = "done" | "error" | "stopped";

// On globalThis so it survives the dev server reloading this module. ``tradingOnFinish``
// is the queue's hook (lib/queue.ts), set there so this module does not import it.
const store = globalThis as unknown as {
  tradingRun?: Run;
  tradingOnFinish?: (outcome: RunOutcome, job: any, source: RunSource) => void;
};

export const currentRun = () => store.tradingRun;
export const isRunning = () => Boolean(store.tradingRun && !store.tradingRun.finished);

function finish(run: Run) {
  if (run.finished) return;
  run.finished = true;
  // The folder is the record; the database row is read back from it.
  try {
    indexRun(saveRun(run.job, run.events, run.source));
  } catch (err) {
    console.error("Could not save the run to history:", err);
  }
  for (const listener of run.listeners) listener("");
  run.listeners.clear();
  // The bridge can linger on library threads after its last line.
  run.child.kill();
  const last = run.events[run.events.length - 1] ?? "";
  const outcome: RunOutcome = /"type":\s*"done"/.test(last) ? "done" : /"type":"stopped"/.test(last) ? "stopped" : "error";
  store.tradingOnFinish?.(outcome, run.job, run.source);
}

/** Start a run now; use lib/queue.ts to start one when the current one is done. */
export function startRun(job: any, source: RunSource = { type: "manual" }) {
  const child = bridge("run");
  const run: Run = { events: [], listeners: new Set(), child, finished: false, job, source };
  store.tradingRun = run;

  const push = (line: string) => {
    const stamped = line.replace(/^\{/, `{"at":${Date.now()},`);
    run.events.push(stamped);
    for (const listener of run.listeners) listener(stamped);
    if (/"type":\s*"(done|error)"/.test(line)) finish(run);
  };

  let buffer = "";
  child.stdout!.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf-8");
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) push(line);
    }
  });
  child.on("error", (err) => push(errorLine(`Không chạy được Python: ${err.message}`).trim()));
  child.on("close", () => {
    if (!run.finished) push(errorLine("Tiến trình phân tích đã dừng.").trim());
  });
  child.stdin!.end(JSON.stringify(job));
}

export function stopRun() {
  const run = store.tradingRun;
  if (run && !run.finished) {
    run.events.push(`{"at":${Date.now()},"type":"stopped"}`);
    for (const listener of run.listeners) listener(run.events[run.events.length - 1]);
    finish(run);
  }
}

/** Every event so far, then each new one, ending when the run does. */
export function follow(run: Run, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let listener: ((line: string) => void) | null = null;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of run.events) controller.enqueue(encoder.encode(line + "\n"));
      if (run.finished) return controller.close();
      listener = (line) => {
        if (line) controller.enqueue(encoder.encode(line + "\n"));
        else controller.close();
      };
      run.listeners.add(listener);
      // A page that goes away stops listening; the run carries on.
      signal.addEventListener("abort", () => listener && run.listeners.delete(listener));
    },
    cancel() {
      if (listener) run.listeners.delete(listener);
    },
  });
}
