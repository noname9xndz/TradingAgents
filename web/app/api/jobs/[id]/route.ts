import { deleteJob, readJobs, saveJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const id = (await params).id;
  if (!readJobs().some((j) => j.id === id)) return Response.json({ error: "Không tìm thấy job." }, { status: 404 });
  const body = await req.json();
  if (!body.name?.trim() || !body.symbols?.length) return Response.json({ error: "Cần tên job và ít nhất một mã." }, { status: 400 });
  return Response.json(saveJob({ ...body, id }));
}

export async function DELETE(_req: Request, { params }: Params) {
  deleteJob((await params).id);
  return Response.json({ ok: true });
}
