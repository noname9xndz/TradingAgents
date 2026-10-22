import { insertError } from "./db";
import { errorKind } from "./error-kinds";

/** Where an error happened: an analysis, or the parts of the server around it. */
export type ErrorScope = "run" | "scheduler" | "queue" | "history" | "telegram";

export type ErrorContext = { detail?: string; runId?: string; ticker?: string; jobId?: string; jobName?: string };

/** Record an error in the errors table (and the server log). Never throws: logging must not break what failed. */
export function recordError(scope: ErrorScope, err: unknown, context: ErrorContext = {}) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${scope}]`, message);
  try {
    insertError({
      at: Date.now(),
      scope,
      kind: errorKind(`${message}\n${context.detail ?? ""}`),
      message,
      detail: context.detail ?? (err instanceof Error ? err.stack : undefined),
      ...context,
    });
  } catch (dbErr) {
    console.error("Could not record the error:", dbErr);
  }
}
