import { filterChoices, queryRuns } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Saved runs, newest first, a page at a time, narrowed by the filters in the query string;
 * ?choices lists the providers and models the filters can offer. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.has("choices")) return Response.json(filterChoices());
  const get = (key: string) => params.get(key) || undefined;
  const num = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  return Response.json(
    queryRuns({
      id: get("id"),
      category: get("category"),
      source: get("source"),
      ticker: get("ticker"),
      rating: get("rating"),
      provider: get("provider"),
      model: get("model"),
      analyst: get("analyst"),
      from: get("from"),
      to: get("to"),
      page: num("page"),
      pageSize: num("pageSize"),
    }),
  );
}
