import { getSetting, putSetting } from "./db";

/** What the settings page keeps: API keys entered there, and the defaults a new
 * analysis starts from. In the settings table of history.db (lib/db.ts). */

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
  return { keys: getSetting("keys", {}), defaults: getSetting("defaults", {}) };
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
  putSetting("keys", settings.keys);
  if (defaults) putSetting("defaults", defaults);
}

/** The keys as the page may see them: never the value, only its last characters. */
export function maskedKeys(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(readSettings().keys).map(([name, value]) => [name, value.length > 8 ? `••••${value.slice(-4)}` : "••••"]),
  );
}

/** The environment a bridge process runs with: keys from the page win over .env. */
export const keyEnv = () => readSettings().keys;
