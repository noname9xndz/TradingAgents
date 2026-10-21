import { queued } from "@/lib/queue";
import { currentRun, isRunning } from "@/lib/runs";

export const dynamic = "force-dynamic";

/** The run going now, and the runs waiting their turn in order. */
export async function GET() {
  const run = isRunning() ? currentRun() : undefined;
  return Response.json({
    running: run ? { ticker: run.job?.ticker, date: run.job?.date, source: run.source } : null,
    waiting: queued().map(({ id, job, source, enqueuedAt }) => ({
      id,
      ticker: job.ticker,
      date: job.date,
      provider: job.provider,
      quick: job.quick,
      source,
      enqueuedAt,
    })),
  });
}
