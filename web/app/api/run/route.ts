import { enqueue, queued } from "@/lib/queue";
import { currentRun, follow, isRunning, stopRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

const NDJSON = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" };

/** Start a run, or put it in line behind the one running ({ position } > 0). It lives on the
 * server: GET follows the current run, DELETE stops it. */
export async function POST(req: Request) {
  return Response.json({ position: enqueue(await req.json()) });
}

/** The running analysis: its events from the start, then live until it ends. */
export async function GET(req: Request) {
  const run = currentRun();
  // ?status asks only whether a run is going, for the home page.
  if (new URL(req.url).searchParams.has("status")) {
    const waiting = queued().length;
    if (!isRunning()) return Response.json({ running: false, waiting });
    const start = run!.events.map((line) => JSON.parse(line)).find((e) => e.type === "start") ?? {};
    return Response.json({ running: true, ticker: start.ticker ?? run!.job?.ticker, date: start.date ?? run!.job?.date, waiting });
  }
  // Only a run in progress: a finished one is in the history, and the page is free for a new one.
  if (!run || !isRunning()) return new Response(null, { status: 204 });
  return new Response(follow(run, req.signal), { headers: NDJSON });
}

export async function DELETE() {
  stopRun();
  return Response.json({ ok: true });
}
