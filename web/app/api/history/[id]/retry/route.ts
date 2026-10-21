import { queryRuns } from "@/lib/db";
import { enqueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** Run a saved analysis again with what it was asked for. Runs saved before the request was kept
 * are rebuilt from their recorded settings. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const meta = queryRuns({ id: (await params).id }).runs[0];
  if (!meta) return Response.json({ error: "Không tìm thấy lần chạy này." }, { status: 404 });
  const s = (meta.settings ?? {}) as Record<string, any>;
  const job = meta.request ?? {
    ticker: s.requested_ticker ?? meta.ticker,
    category: s.category ?? meta.category,
    date: meta.date,
    analysts: s.requested_analysts ?? meta.analysts,
    language: meta.language ?? s.output_language,
    depth: meta.depth ?? s.max_debate_rounds ?? 1,
    provider: meta.provider,
    quick: meta.quick,
    deep: meta.deep,
    backendUrl: s.backend ?? undefined,
  };
  const source = meta.source?.type === "job" ? { ...meta.source, attempt: meta.source.attempt + 1 } : { type: "manual" as const };
  return Response.json({ position: enqueue(job, source) });
}
