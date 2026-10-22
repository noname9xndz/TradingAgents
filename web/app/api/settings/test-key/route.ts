import { testKey } from "@/lib/key-tests";
import { keyEnv } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** { name, value? }: test the typed value, else the saved one, else the one in .env. */
export async function POST(req: Request) {
  const { name, value } = await req.json();
  const saved = keyEnv()[name] ?? process.env[name] ?? "";
  return Response.json(await testKey(String(name), String(value ?? "").trim() || saved));
}
