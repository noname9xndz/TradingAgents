import { maskedKeys, readSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** The saved defaults, and which keys the page has set (masked, never the value). */
export async function GET() {
  return Response.json({ keys: maskedKeys(), defaults: readSettings().defaults });
}

/** { keys?: { NAME: value | "" }, defaults?: {...} } — an empty value removes a key. */
export async function PUT(req: Request) {
  const body = await req.json();
  try {
    updateSettings(body.keys, body.defaults);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  return Response.json({ keys: maskedKeys(), defaults: readSettings().defaults });
}
