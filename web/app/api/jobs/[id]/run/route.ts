import { readJobs, runJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Run a job's symbols now, outside its schedule. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const job = readJobs().find((j) => j.id === id);
  if (!job) return Response.json({ error: "Không tìm thấy job." }, { status: 404 });
  runJob(job);
  return Response.json({ ok: true, symbols: job.symbols.length });
}
