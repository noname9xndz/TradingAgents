import { bridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const child = bridge("options");
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
    child.on("error", (err) => {
      out = JSON.stringify({ type: "error", message: `Không chạy được Python: ${err.message}` });
      resolve(1);
    });
  });
  const data = JSON.parse(out.trim().split("\n").pop() || "{}");
  return Response.json(data, { status: code === 0 ? 200 : 500 });
}
