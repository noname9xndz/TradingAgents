/** What the home page and a run's page both show. */
export type RunMeta = {
  id: string;
  ticker: string;
  date: string;
  provider: string;
  quick: string;
  deep: string;
  analysts: string[];
  startedAt: number;
  endedAt: number;
  status: "done" | "error" | "stopped";
  rating?: string;
  reportPath?: string;
  error?: string;
  language?: string;
  depth?: number;
  settings?: Record<string, unknown>;
  category?: string;
  source?: { type: "manual" } | { type: "job"; jobId: string; jobName: string; attempt: number; retries: number };
  request?: Record<string, unknown>;
  usage?: Usage;
};

export type TokenCount = { calls: number; input: number; output: number; reasoning: number; cached: number };
export type Usage = { total: TokenCount; models: Record<string, TokenCount> };

/** The lists a symbol is picked from; any other symbol is typed in. */
export const CATEGORIES: { key: string; label: string; symbols: string[] }[] = [
  { key: "stock", label: "Chứng khoán", symbols: ["SPY", "AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL"] },
  { key: "crypto", label: "Crypto", symbols: ["BTCUSDT", "ETHUSDT"] },
  { key: "forex", label: "Forex & hàng hoá", symbols: ["XAUUSD", "XAGUSD", "USOIL", "GBPUSD", "EURUSD"] },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export const RATING_STYLE: Record<string, string> = {
  Buy: "bg-emerald-500 text-emerald-950",
  Overweight: "bg-lime-400 text-lime-950",
  Hold: "bg-amber-400 text-amber-950",
  Underweight: "bg-orange-500 text-orange-950",
  Sell: "bg-red-500 text-red-950",
};

/** Tokens for a person: 2186.2k, 1.2M. */
export const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
