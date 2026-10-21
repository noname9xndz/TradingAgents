import { removeQueued } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** Take a waiting run out of the line. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  removeQueued((await params).id);
  return Response.json({ ok: true });
}
