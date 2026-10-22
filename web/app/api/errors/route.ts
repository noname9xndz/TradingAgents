import { clearErrors, queryErrors } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The error log, newest first: ?scope=&kind=&from=&page=&pageSize= */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const num = (name: string) => (q.get(name) ? Number(q.get(name)) : undefined);
  return Response.json(
    queryErrors({ scope: q.get("scope") || undefined, kind: q.get("kind") || undefined, from: num("from"), page: num("page"), pageSize: num("pageSize") }),
  );
}

/** Empty the log. */
export async function DELETE() {
  clearErrors();
  return Response.json({ ok: true });
}
