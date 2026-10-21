import { unindexRun } from "@/lib/db";
import { deleteFailedRun, runEvents } from "@/lib/history";

export const dynamic = "force-dynamic";

/** A saved run's events, in the same lines the live stream sends. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const events = runEvents((await params).id);
  if (events === null) return new Response("Không tìm thấy lần chạy này.", { status: 404 });
  return new Response(events, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}

/** Remove a failed run, from its folder and the index. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!deleteFailedRun(id)) return new Response("Chỉ xoá được lần chạy bị lỗi.", { status: 400 });
  unindexRun(id);
  return Response.json({ ok: true });
}
