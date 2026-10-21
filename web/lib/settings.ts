import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** What the settings page keeps: API keys entered there, and the defaults a new
 * analysis starts from. In the data folder, so a container keeps it too. */
export const SETTINGS_PATH =
  process.env.TRADINGAGENTS_WEB_SETTINGS || path.join(os.homedir(), ".tradingagents", "web_settings.json");

export type Defaults = {
  provider?: string;
  quick?: string;
  deep?: string;
  backendUrl?: string;
  language?: string;
  depth?: number;
  analysts?: string[];
};

type Settings = { keys: Record<string, string>; defaults: Defaults };

// Only variable names a provider or data vendor reads may be set from the page.
const KEY_NAME = /^[A-Z][A-Z0-9_]*_(API_KEY|USER_AGENT)$/;

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    return { keys: raw.keys ?? {}, defaults: raw.defaults ?? {} };
  } catch {
    return { keys: {}, defaults: {} };
  }
}

function write(settings: Settings) {
  mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  // It holds API keys: readable by its owner only.
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), { encoding: "utf-8", mode: 0o600 });
  chmodSync(SETTINGS_PATH, 0o600);
}

/** Set keys (an empty value removes one) and replace the defaults when given. */
export function updateSettings(keys: Record<string, string> = {}, defaults?: Defaults) {
  const settings = readSettings();
  for (const [name, value] of Object.entries(keys)) {
    if (!KEY_NAME.test(name)) throw new Error(`Không nhận biến ${name}.`);
    const trimmed = String(value ?? "").trim();
    if (trimmed) settings.keys[name] = trimmed;
    else delete settings.keys[name];
  }
  if (defaults) settings.defaults = defaults;
  write(settings);
}

/** The keys as the page may see them: never the value, only its last characters. */
export function maskedKeys(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(readSettings().keys).map(([name, value]) => [name, value.length > 8 ? `••••${value.slice(-4)}` : "••••"]),
  );
}

/** The environment a bridge process runs with: keys from the page win over .env. */
export const keyEnv = () => readSettings().keys;
