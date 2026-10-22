import { recordError } from "./errors";
import { getSetting, putSetting } from "./db";

/** Telegram notice when a symbol's analysis finishes: only the final decision. Kept in the settings table. */
export type Telegram = { enabled: boolean; botToken: string; chatId: string };

const EMPTY: Telegram = { enabled: false, botToken: "", chatId: "" };

export const readTelegram = (): Telegram => ({ ...EMPTY, ...getSetting<Partial<Telegram>>("telegram", {}) });

/** What the page may see: the token only by its last characters. */
export function maskedTelegram() {
  const { botToken, ...rest } = readTelegram();
  return { ...rest, botToken: botToken ? `••••${botToken.slice(-4)}` : "" };
}

/** An empty botToken keeps the saved one; ``clearToken`` removes it. */
export function saveTelegram(patch: { enabled?: boolean; botToken?: string; chatId?: string; clearToken?: boolean }) {
  const current = readTelegram();
  const botToken = patch.clearToken ? "" : patch.botToken?.trim() || current.botToken;
  if (botToken && !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) throw new Error("Bot token không đúng dạng 123456:ABC…");
  putSetting("telegram", {
    enabled: patch.enabled ?? current.enabled,
    botToken,
    chatId: (patch.chatId ?? current.chatId).trim(),
  });
}

export async function sendTelegram(text: string, config = readTelegram()) {
  if (!config.botToken || !config.chatId) throw new Error("Cần bot token và chat ID.");
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`Telegram: ${body.description ?? res.status}`);
}

// Telegram takes at most 4096 characters a message.
const LIMIT = 4000;

/** Markdown as plain text: Telegram would show the ** and # as they are. */
const plain = (md: string) =>
  md
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();

/** The message for a finished run, in the report's language. */
export function decisionMessage(run: { ticker: string; date: string; rating?: string; language?: string; source?: any }, decision: string) {
  const vi = run.language === "Vietnamese";
  const origin = run.source?.type === "job" ? `⏰ ${run.source.jobName}` : vi ? "Thủ công" : "Manual";
  const head = [
    `📊 ${run.ticker} · ${run.date}`,
    `${vi ? "Đánh giá" : "Rating"}: ${run.rating ?? "—"}`,
    `${vi ? "Nguồn" : "Source"}: ${origin}`,
    "",
  ].join("\n");
  const body = plain(decision);
  const room = LIMIT - head.length;
  return head + (body.length > room ? `${body.slice(0, room - 1)}…` : body);
}

/** Send the final decision of a finished run, when the notice is on. Never throws: a failed notice is only logged. */
export async function notifyDecision(run: Parameters<typeof decisionMessage>[0], decision: string) {
  const config = readTelegram();
  if (!config.enabled || !config.botToken || !config.chatId) return;
  try {
    await sendTelegram(decisionMessage(run, decision || "—"), config);
  } catch (err) {
    recordError("telegram", err, { ticker: run.ticker });
  }
}
