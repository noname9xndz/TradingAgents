import { maskedTelegram, saveTelegram, sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** The Telegram notice settings; the bot token only masked. */
export async function GET() {
  return Response.json(maskedTelegram());
}

/** { enabled?, botToken?, chatId?, clearToken? } — an empty botToken keeps the saved one. */
export async function PUT(req: Request) {
  try {
    saveTelegram(await req.json());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  return Response.json(maskedTelegram());
}

/** Send a test message with the saved settings. */
export async function POST() {
  try {
    await sendTelegram("✅ TradingAgents: Telegram OK.");
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true });
}
