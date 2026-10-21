/** Next.js runs this once when the server starts: start the run queue and the job scheduler. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startQueueWorker } = await import("./lib/queue");
    const { startScheduler } = await import("./lib/jobs");
    startQueueWorker();
    startScheduler();
  }
}
