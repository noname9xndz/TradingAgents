import { jobHistory, readJobs, saveJob } from "@/lib/jobs";
import { queued } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** The jobs, the runs waiting their turn, and when the jobs last went off. */
export async function GET() {
  return Response.json({ jobs: readJobs(), queue: queued().map(({ id, job, source, enqueuedAt }) => ({ id, ticker: job.ticker, source, enqueuedAt })), history: jobHistory() });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name?.trim() || !body.symbols?.length) return Response.json({ error: "Cần tên job và ít nhất một mã." }, { status: 400 });
  return Response.json(saveJob({ ...body, id: undefined }));
}
