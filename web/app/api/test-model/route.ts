import { bridge } from "@/lib/bridge";
import { errorKind } from "@/lib/error-kinds";

export const dynamic = "force-dynamic";

// Free models can think for a minute before they answer.
const TIMEOUT = 150_000;

/** Call the quick and deep models once: { provider, quick, deep, backendUrl } → which answered, which failed and why. */
export async function POST(req: Request) {
  const job = await req.json();
  if (!job.provider || !job.quick || !job.deep) return Response.json({ error: "Cần chọn nhà cung cấp và model." }, { status: 400 });
  const child = bridge("ping");
  let out = "";
  child.stdout!.on("data", (chunk: Buffer) => (out += chunk.toString("utf-8")));
  const closed = new Promise((done) => child.on("close", done));
  child.stdin!.end(JSON.stringify({ provider: job.provider, quick: job.quick, deep: job.deep, backendUrl: job.backendUrl }));
  const timer = setTimeout(() => child.kill(), TIMEOUT);
  await closed;
  clearTimeout(timer);
  const last = out.trim().split("\n").pop() ?? "";
  try {
    const event = JSON.parse(last);
    if (event.type === "error") return Response.json({ error: event.message, kind: errorKind(event.message) }, { status: 502 });
    return Response.json({
      results: event.results.map((r: any) => (r.ok ? r : { ...r, kind: errorKind(r.error) })),
    });
  } catch {
    return Response.json({ error: "Quá thời gian chờ model trả lời.", kind: "network" }, { status: 504 });
  }
}
