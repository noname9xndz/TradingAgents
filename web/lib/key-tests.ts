/** "Test" on the settings page: one small request per data source, to tell a working key from a wrong one. */

const TIMEOUT = 20_000;

type Outcome = { ok: boolean; message: string };

async function get(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  return { status: res.status, text: await res.text() };
}

const json = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const TESTS: Record<string, (value: string) => Promise<Outcome>> = {
  async FRED_API_KEY(key) {
    const { status, text } = await get(
      `https://api.stlouisfed.org/fred/series?series_id=DGS10&file_type=json&api_key=${encodeURIComponent(key)}`,
    );
    const body = json(text);
    if (status === 200 && body.seriess) return { ok: true, message: "FRED trả dữ liệu (lãi suất 10 năm)." };
    return { ok: false, message: body.error_message ?? `HTTP ${status}` };
  },

  async ALPHA_VANTAGE_API_KEY(key) {
    const { status, text } = await get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=${encodeURIComponent(key)}`);
    const body = json(text);
    if (body["Global Quote"]?.["05. price"]) return { ok: true, message: "Alpha Vantage trả giá IBM." };
    // A wrong key and a used-up daily limit both come back as 200 with a note.
    return { ok: false, message: body["Error Message"] ?? body.Information ?? body.Note ?? `HTTP ${status}` };
  },

  async TYPESAFE_API_KEY(key) {
    const base = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/$/, "");
    const { status, text } = await get(`${base}/v1/systemone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        state: { post: "AAPL earnings beat expectations.", instrument: "Apple (AAPL)" },
        model: process.env.TYPESAFE_DEFAULT_MODEL || "jev-latest",
        questions: { about: { type: "noul", instructions: "Is `post` about `instrument`?", criteria: { true: "Yes.", false: "No." } } },
      }),
    });
    if (status === 200 && json(text).answers) return { ok: true, message: "TypeSafe Jev trả lời." };
    return { ok: false, message: json(text).error?.message ?? json(text).detail ?? `HTTP ${status}` };
  },

  async SEC_EDGAR_USER_AGENT(agent) {
    // SEC asks for "Name email"; it refuses requests without a contact.
    if (!/\S+@\S+\.\S+/.test(agent)) return { ok: false, message: "Cần có email, ví dụ “Ten Ban ban@email.com”." };
    const { status } = await get("https://data.sec.gov/submissions/CIK0000320193.json", { headers: { "User-Agent": agent } });
    if (status === 200) return { ok: true, message: "SEC EDGAR nhận User-Agent (đọc được hồ sơ Apple)." };
    return { ok: false, message: status === 403 ? "SEC từ chối User-Agent này (403)." : `HTTP ${status}` };
  },
};

export const testableKeys = Object.keys(TESTS);

/** Run the test for ``name`` with ``value``; never throws, and the key never appears in the message. */
export async function testKey(name: string, value: string): Promise<Outcome> {
  const test = TESTS[name];
  if (!test) return { ok: false, message: "Không có bài kiểm tra cho biến này." };
  if (!value) return { ok: false, message: "Chưa có giá trị để kiểm tra." };
  try {
    const outcome = await test(value);
    return { ...outcome, message: outcome.message.split(value).join("••••").slice(0, 300) };
  } catch (err) {
    return { ok: false, message: (err as Error).name === "TimeoutError" ? "Quá thời gian chờ." : (err as Error).message };
  }
}
