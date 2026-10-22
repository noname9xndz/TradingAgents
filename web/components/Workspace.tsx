"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TestModels from "@/components/TestModels";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, CATEGORY_LABEL, RATING_STYLE, fmtTokens, type RunMeta, type Usage } from "@/lib/shared";

type ModelList = [string, string][];
type Provider = { key: string; label: string; url: string | null; keyEnv: string | null; ready: boolean };
type Options = {
  providers: Provider[];
  models: Record<string, { quick: ModelList; deep: ModelList }>;
  analysts: string[];
  languages: string[];
  defaults: { provider: string; quick: string; deep: string };
};
type Form = {
  category: string; // the list the symbol comes from: stock / crypto / forex
  customTicker: boolean; // typed in rather than picked from the list
  ticker: string;
  date: string;
  analysts: string[];
  language: string;
  depth: number;
  provider: string;
  quick: string;
  deep: string;
  quickCustom: string;
  deepCustom: string;
  backendUrl: string;
};
type Sections = Record<string, string>;
type FeedItem = { at: number; section?: string; analyst?: string; text: string; tool?: boolean };

// Who speaks for each section in the live feed, and the colour of their team.
const SPEAKERS: Record<string, { name: string; team: string }> = {
  market_report: { name: "Analyst Thị trường", team: "sky" },
  sentiment_report: { name: "Analyst Tâm lý", team: "sky" },
  news_report: { name: "Analyst Tin tức", team: "sky" },
  fundamentals_report: { name: "Analyst Cơ bản", team: "sky" },
  bull_history: { name: "Bull Researcher", team: "emerald" },
  bear_history: { name: "Bear Researcher", team: "rose" },
  investment_plan: { name: "Research Manager", team: "violet" },
  trader_investment_plan: { name: "Trader", team: "amber" },
  aggressive_history: { name: "Rủi ro: Mạo hiểm", team: "orange" },
  conservative_history: { name: "Rủi ro: Thận trọng", team: "teal" },
  neutral_history: { name: "Rủi ro: Trung lập", team: "slate" },
  final_trade_decision: { name: "Portfolio Manager", team: "fuchsia" },
};
const TEAM_BORDER: Record<string, string> = {
  sky: "border-sky-500",
  emerald: "border-emerald-500",
  rose: "border-rose-500",
  violet: "border-violet-500",
  amber: "border-amber-400",
  orange: "border-orange-500",
  teal: "border-teal-400",
  slate: "border-slate-400",
  fuchsia: "border-fuchsia-500",
};
const TEAM_TEXT: Record<string, string> = {
  sky: "text-sky-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
  amber: "text-amber-300",
  orange: "text-orange-300",
  teal: "text-teal-300",
  slate: "text-slate-300",
  fuchsia: "text-fuchsia-300",
};
// Debate turns open with the speaker's English label; the card already names them.
const stripSpeaker = (text: string) => text.replace(/^(Bull|Bear|Aggressive|Conservative|Neutral) Analyst:\s*/, "");
const clock = (at: number, locale: string) => new Date(at).toLocaleTimeString(locale);

// The stage of the run each section belongs to; the labels match stages().
const SECTION_PHASE: Record<string, string> = {
  market_report: "Thị trường",
  sentiment_report: "Tâm lý",
  news_report: "Tin tức",
  fundamentals_report: "Cơ bản",
  bull_history: "Tranh luận Bull/Bear",
  bear_history: "Tranh luận Bull/Bear",
  investment_plan: "Tranh luận Bull/Bear",
  trader_investment_plan: "Trader",
  aggressive_history: "Tranh luận rủi ro",
  conservative_history: "Tranh luận rủi ro",
  neutral_history: "Tranh luận rủi ro",
  final_trade_decision: "Quyết định cuối",
};
const phaseOf = (item: FeedItem) =>
  item.tool ? (ANALYSTS[item.analyst ?? ""]?.label ?? "") : (SECTION_PHASE[item.section ?? ""] ?? "");

/** The form values the settings page's defaults set; a model outside the list is a custom id. */
function fromDefaults(d: Record<string, any>, o: Options): Partial<Form> {
  const out: Partial<Form> = {};
  if (d.provider && o.models[d.provider]) {
    const models = o.models[d.provider];
    out.provider = d.provider;
    out.backendUrl = d.backendUrl ?? "";
    for (const tier of ["quick", "deep"] as const) {
      if (!d[tier]) continue;
      const listed = models[tier].some(([, v]) => v === d[tier]);
      out[tier] = listed ? d[tier] : "custom";
      if (!listed) out[tier === "quick" ? "quickCustom" : "deepCustom"] = d[tier];
    }
  }
  if (d.language) out.language = d.language;
  if (d.depth) out.depth = d.depth;
  if (d.analysts?.length) out.analysts = d.analysts;
  return out;
}

function UsageDetail({ usage }: { usage: Usage }) {
  const { t } = useI18n();
  const rows = Object.entries(usage.models);
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase">{t("Token")}</div>
      <div className="text-slate-200">
        {fmtTokens(usage.total.input)} {t("vào")} · {fmtTokens(usage.total.output)} {t("ra")} ·{" "}
        {t("{n} lượt gọi", { n: usage.total.calls })}
      </div>
      <table className="mt-1 w-full text-xs text-slate-400">
        <tbody>
          {rows.map(([model, c]) => (
            <tr key={model} className="border-t border-slate-800 align-top">
              <td className="py-1 pr-2 break-all">{model}</td>
              <td className="py-1 text-right whitespace-nowrap">
                {fmtTokens(c.input)}↑ {fmtTokens(c.output)}↓
                <div className="text-slate-500">
                  {t("{n} lượt gọi", { n: c.calls })}
                  {c.reasoning ? ` · ${t("suy nghĩ")} ${fmtTokens(c.reasoning)}` : ""}
                  {c.cached ? ` · ${t("cache")} ${fmtTokens(c.cached)}` : ""}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="break-all text-slate-200">{value || "—"}</div>
    </div>
  );
}

function TypingCard({ section, text }: { section: string; text: string }) {
  const { t } = useI18n();
  const who = SPEAKERS[section] ?? { name: section, team: "slate" };
  return (
    <div className={`rounded-md border-l-4 border-dashed bg-slate-900 p-4 ${TEAM_BORDER[who.team]}`}>
      <div className={`mb-1 font-semibold ${TEAM_TEXT[who.team]}`}>
        {t(who.name)} <span className="animate-pulse text-xs font-normal text-slate-400">{t("đang viết…")}</span>
      </div>
      <div className="text-sm leading-6 whitespace-pre-wrap text-slate-300">
        {text.length > 1500 ? "…" + text.slice(-1500) : text}
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  if (item.tool)
    return (
      <div className="font-mono text-xs break-all text-slate-500">
        {clock(item.at, locale)} ·{" "}
        {t("{who} lấy dữ liệu:", { who: item.analyst ? t(`Analyst ${ANALYSTS[item.analyst]?.label ?? item.analyst}`) : "Agent" })}{" "}
        {item.text}
      </div>
    );
  const who = SPEAKERS[item.section!] ?? { name: item.section!, team: "slate" };
  const long = item.text.length > 1200;
  return (
    <div className={`rounded-md border-l-4 bg-slate-900 p-4 ${TEAM_BORDER[who.team]}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`font-semibold ${TEAM_TEXT[who.team]}`}>{t(who.name)}</span>
        <span className="text-xs text-slate-500">{clock(item.at, locale)}</span>
      </div>
      <div className={`report relative ${long && !open ? "max-h-72 overflow-hidden" : ""}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripSpeaker(item.text)}</ReactMarkdown>
        {long && !open && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900" />}
      </div>
      {long && (
        <button className="mt-2 text-xs text-emerald-400 hover:underline" onClick={() => setOpen(!open)}>
          {open ? t("Thu gọn") : t("Xem đầy đủ")}
        </button>
      )}
    </div>
  );
}

const ANALYSTS: Record<string, { label: string; section: string }> = {
  market: { label: "Thị trường", section: "market_report" },
  social: { label: "Tâm lý", section: "sentiment_report" },
  news: { label: "Tin tức", section: "news_report" },
  fundamentals: { label: "Cơ bản", section: "fundamentals_report" },
};

const SECTION_LABELS: [string, string][] = [
  ["final_trade_decision", "Quyết định cuối"],
  ["market_report", "Thị trường"],
  ["sentiment_report", "Tâm lý"],
  ["news_report", "Tin tức"],
  ["fundamentals_report", "Cơ bản"],
  ["bull_history", "Phe mua (Bull)"],
  ["bear_history", "Phe bán (Bear)"],
  ["investment_plan", "Research Manager"],
  ["trader_investment_plan", "Trader"],
  ["aggressive_history", "Rủi ro: Mạo hiểm"],
  ["conservative_history", "Rủi ro: Thận trọng"],
  ["neutral_history", "Rủi ro: Trung lập"],
];

const DEPTHS: [number, string][] = [
  [1, "Nông: nhanh, ít vòng tranh luận"],
  [3, "Trung bình"],
  [5, "Sâu: tranh luận kỹ"],
];


const FORM_KEY = "tradingagents-form";
const OTHER = "__other";
const PLACEHOLDER: Record<string, string> = {
  stock: "VD: 0700.HK, 7203.T, AZN.L",
  crypto: "VD: SOLUSDT, BNB-USD",
  forex: "VD: USDJPY, XPTUSD, UKOIL",
};

/** Which list a remembered symbol belongs to, and whether it was typed in. */
function pickedFrom(ticker: string, category?: string): Pick<Form, "ticker" | "category" | "customTicker"> {
  // "XAU/USD" as a broker writes it is the listed XAUUSD.
  const symbol = ticker.toUpperCase().replace("/", "");
  const listed = CATEGORIES.find((c) => c.symbols.includes(symbol));
  const key = category ?? listed?.key ?? "stock";
  const list = CATEGORIES.find((c) => c.key === key)?.symbols ?? [];
  return list.includes(symbol) ? { ticker: symbol, category: key, customTicker: false } : { ticker, category: key, customTicker: true };
}
const today = () => new Date().toLocaleDateString("sv-SE");
const firstModel = (list: ModelList = []) => (list.find(([, v]) => v !== "custom") ?? ["", "custom"])[1];

type Status = "waiting" | "running" | "done";

function stages(form: Form, s: Sections, started: boolean): { label: string; status: Status }[] {
  const has = (k: string) => Boolean(s[k]);
  const step = (done: boolean, ready: boolean): Status => (done ? "done" : started && ready ? "running" : "waiting");
  const analysts = form.analysts.map((a) => ({
    label: ANALYSTS[a].label,
    status: step(has(ANALYSTS[a].section), true),
  }));
  const analystsDone = analysts.every((a) => a.status === "done");
  const decided = has("final_trade_decision");
  return [
    ...analysts,
    { label: "Tranh luận Bull/Bear", status: step(has("investment_plan"), analystsDone) },
    { label: "Trader", status: step(has("trader_investment_plan"), has("investment_plan")) },
    { label: "Tranh luận rủi ro", status: step(decided, has("trader_investment_plan")) },
    { label: "Quyết định cuối", status: step(decided, has("neutral_history")) },
  ];
}

export default function Workspace({ runId }: { runId?: string }) {
  const { t, locale } = useI18n();
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [sections, setSections] = useState<Sections>({});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  // The analysts this run started with; the form may change while it runs.
  const [runAnalysts, setRunAnalysts] = useState<string[]>([]);
  // The saved run on screen, or null while showing the server's current run.
  const [viewing, setViewing] = useState<RunMeta | null>(null);
  const [follow, setFollow] = useState(true);
  const feedBox = useRef<HTMLDivElement | null>(null);
  // What each agent is writing right now. Tokens arrive many per second, so they
  // collect in a ref and reach the page a few times a second.
  const [typing, setTyping] = useState<Record<string, string>>({});
  const typingBuf = useRef<Record<string, string>>({});
  const runStart = useRef(0);
  const [tab, setTab] = useState("");
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [rating, setRating] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const [reportPath, setReportPath] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/options").then((r) => r.json()),
      fetch("/api/settings")
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([o, settings]) => {
        if (o.type === "error") throw new Error(o.message);
        setOptions(o);
        let saved: Partial<Form> = {};
        try {
          saved = JSON.parse(localStorage.getItem(FORM_KEY) || "{}");
        } catch {}
        // Defaults from the settings page come before what the last run used.
        saved = { ...saved, ...fromDefaults(settings.defaults ?? {}, o) };
        const provider = saved.provider && o.models[saved.provider] ? saved.provider : o.defaults.provider;
        setForm({
          analysts: o.analysts,
          language: "Vietnamese",
          depth: 1,
          quick: provider === o.defaults.provider ? o.defaults.quick : firstModel(o.models[provider]?.quick),
          deep: provider === o.defaults.provider ? o.defaults.deep : firstModel(o.models[provider]?.deep),
          quickCustom: "",
          deepCustom: "",
          backendUrl: o.providers.find((p: Provider) => p.key === provider)?.url ?? "",
          ...saved,
          ...pickedFrom(saved.ticker ?? "SPY", saved.category),
          provider,
          date: today(),
        });
      })
      .catch((e) => setLoadError(String(e.message || e)));
  }, []);

  // A saved run when the address names one, else the server's run in progress (or its last).
  useEffect(() => {
    if (runId) openRun(runId);
    else attach();
    return () => abort.current?.abort();
  }, [runId]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - runStart.current) / 1000)), 1000);
    const flush = setInterval(() => setTyping({ ...typingBuf.current }), 250);
    return () => {
      clearInterval(id);
      clearInterval(flush);
    };
  }, [running]);

  useEffect(() => {
    const box = feedBox.current;
    if (follow && box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [feed, typing, follow]);

  if (loadError)
    return (
      <main className="p-8 text-red-300">
        {t("Không tải được cấu hình từ Python:")} {loadError}
        <p className="mt-2 text-sm text-slate-400">
          {t("Kiểm tra đã cài package tradingagents trong .venv ở thư mục gốc (pip install -e .), hoặc đặt biến PYTHON trỏ tới python có tradingagents.")}
        </p>
      </main>
    );
  if (!options || !form) return <main className="p-8 text-slate-400">{t("Đang tải…")}</main>;

  const provider = options.providers.find((p) => p.key === form.provider);
  const models = options.models[form.provider] ?? { quick: [], deep: [] };
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });

  const chooseProvider = (key: string) =>
    set({
      provider: key,
      quick: firstModel(options.models[key]?.quick),
      deep: firstModel(options.models[key]?.deep),
      backendUrl: options.providers.find((p) => p.key === key)?.url ?? "",
    });

  const toggleAnalyst = (a: string) =>
    set({
      analysts: form.analysts.includes(a) ? form.analysts.filter((x) => x !== a) : [...form.analysts, a],
    });

  function reset() {
    setSections({});
    setFeed([]);
    typingBuf.current = {};
    setTyping({});
    runStart.current = Date.now();
    setRating("");
    setError("");
    setReportPath("");
    setUsage(null);
    setTab("");
    setElapsed(0);
    setStarted(false);
  }

  /** Follow the server's run: its events from the start, then live until it ends. */
  async function attach() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    let res: Response;
    try {
      res = await fetch("/api/run", { signal: controller.signal });
    } catch {
      return;
    }
    if (res.status === 204 || !res.body) return;
    reset();
    setRunning(true);
    try {
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) handle(JSON.parse(line));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      if (abort.current === controller) setRunning(false);
    }
  }

  const stop = () => fetch("/api/run", { method: "DELETE" });

  /** Show a saved run as it ran: the same events, replayed at once. */
  async function openRun(id: string) {
    abort.current?.abort();
    abort.current = null;
    const [res, metas] = await Promise.all([
      fetch(`/api/history/${encodeURIComponent(id)}`),
      fetch(`/api/history?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((p) => p.runs ?? []),
    ]);
    reset();
    setRunning(false);
    setViewing(metas[0] ?? null);
    if (!res.ok) return setError(await res.text());
    for (const line of (await res.text()).split("\n")) if (line.trim()) handle(JSON.parse(line));
    setTyping({});
  }

  async function run() {
    if (!form) return;
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ ...form, ticker: form.ticker }));
    } catch {}
    // "Mã khác" takes several symbols at once: each joins the line in turn.
    const tickers = form.customTicker ? form.ticker.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) : [form.ticker];
    const job = {
      category: form.category,
      date: form.date,
      analysts: runnable,
      language: form.language,
      depth: form.depth,
      provider: form.provider,
      quick: form.quick === "custom" ? form.quickCustom.trim() : form.quick,
      deep: form.deep === "custom" ? form.deepCustom.trim() : form.deep,
      backendUrl: form.backendUrl,
    };
    let last = 0;
    for (const ticker of tickers) {
      const res = await fetch("/api/run", { method: "POST", body: JSON.stringify({ ...job, ticker }) });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? t("Không bắt đầu được ({status})", { status: res.status }));
        return;
      }
      last = (await res.json()).position;
    }
    setNotice(
      last > 0
        ? t("Đã thêm vào hàng chờ: {list}. Đang có {n} mã chờ, chạy lần lượt.", { list: tickers.join(", "), n: last })
        : "",
    );
    // A run already on screen keeps going; otherwise follow the one that just started.
    if (!running) attach();
  }

  /** Run a saved analysis again with the same request; it joins the line and the page follows it. */
  async function retry() {
    if (!runId) return;
    const res = await fetch(`/api/history/${encodeURIComponent(runId)}/retry`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? t("Không bắt đầu được ({status})", { status: res.status }));
    router.push("/run");
  }

  function handle(ev: any) {
    // The server stamps each event, so a replay after a reload keeps its times.
    const at = ev.at ?? Date.now();
    if (ev.type === "start") {
      setStarted(true);
      setRunAnalysts(ev.analysts);
      runStart.current = at;
    } else if (ev.type === "stopped") setError("Đã dừng lượt phân tích.");
    else if (ev.type === "tool")
      setFeed((f) => [
        ...f,
        { at, tool: true, analyst: ev.analyst, text: `${ev.name}(${Object.values(ev.args).join(", ")})` },
      ]);
    else if (ev.type === "token") {
      const buf = typingBuf.current;
      buf[ev.section] = (buf[ev.section] ?? "") + ev.text;
    } else if (ev.type === "turn") {
      // The finished turn replaces what was being typed for it.
      delete typingBuf.current[ev.section];
      setTyping({ ...typingBuf.current });
      setFeed((f) => [...f, { at, section: ev.section, text: ev.text }]);
    }
    else if (ev.type === "update") setSections((s) => ({ ...s, ...ev.sections }));
    else if (ev.type === "done") {
      setSections(ev.sections);
      setRating(ev.rating);
      setReportPath(ev.reportPath);
      setTab("final_trade_decision");
    } else if (ev.type === "usage") setUsage({ total: ev.total, models: ev.models });
    else if (ev.type === "error") setError(ev.message);
  }

  const modelPicker = (tier: "quick" | "deep", label: string) => (
    <div>
      <label className="label">{label}</label>
      <select className="field" value={form[tier]} onChange={(e) => set({ [tier]: e.target.value })}>
        {models[tier].map(([l, v]) => (
          <option key={v} value={v}>
            {v === "custom" ? t("Nhập model ID khác…") : l}
          </option>
        ))}
      </select>
      {form[tier] === "custom" && (
        <input
          className="field mt-2"
          placeholder={t("model ID, ví dụ qwen3:8b")}
          value={form[tier === "quick" ? "quickCustom" : "deepCustom"]}
          onChange={(e) => set({ [tier === "quick" ? "quickCustom" : "deepCustom"]: e.target.value })}
        />
      )}
    </div>
  );

  const symbols = CATEGORIES.find((c) => c.key === form.category)?.symbols ?? [];
  // Crypto, forex and commodities have no financial statements to read.
  const noStatements = form.category !== "stock";

  const missingModel =
    (form.quick === "custom" && !form.quickCustom.trim()) || (form.deep === "custom" && !form.deepCustom.trim());
  const runnable = form.analysts.filter((a) => !(a === "fundamentals" && noStatements));
  const canRun = form.ticker.trim() && form.date && runnable.length > 0 && !missingModel;
  const available = SECTION_LABELS.filter(([k]) => sections[k]);
  // The model has been thinking since the last thing the run showed; the
  // elapsed-time tick re-renders this every second.
  const lastActivity = feed.length ? feed[feed.length - 1].at : runStart.current;
  // The chosen report, else the first one written so far.
  const shownTab = sections[tab] ? tab : available[0]?.[0];

  return (
    <main className="mx-auto grid max-w-[1800px] gap-6 p-4 md:grid-cols-[300px_minmax(0,1fr)] md:p-6 xl:grid-cols-[300px_minmax(0,1fr)_440px]">
      <aside className="space-y-4 md:sticky md:top-22 md:self-start">

        {runId ? (
          <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-4 text-sm">
            {viewing ? (
              <>
                <Detail label={t("Danh mục")} value={CATEGORY_LABEL[viewing.category ?? ""] && t(CATEGORY_LABEL[viewing.category ?? ""])} />
                <Detail label={t("Mã")} value={viewing.ticker} />
                <Detail label={t("Ngày phân tích")} value={viewing.date} />
                <Detail label={t("Analyst")} value={runAnalysts.map((a) => ANALYSTS[a]?.label ?? a).join(", ")} />
                <Detail label={t("Nhà cung cấp")} value={viewing.provider} />
                <Detail label={t("Model nhanh")} value={viewing.quick} />
                <Detail label={t("Model sâu")} value={viewing.deep} />
                <Detail
                  label={t("Trạng thái")}
                  value={t(viewing.status === "done" ? "Hoàn thành" : viewing.status === "stopped" ? "Đã dừng" : "Lỗi")}
                />
                <Detail label={t("Ngôn ngữ / độ sâu")} value={`${viewing.language ?? "—"} · ${t("{n} vòng", { n: viewing.depth ?? "—" })}`} />
                {viewing.reportPath && <Detail label={t("Report đã lưu")} value={viewing.reportPath} />}
                {usage && <UsageDetail usage={usage} />}
                {viewing.settings && (
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs text-emerald-300">{t("Toàn bộ cấu hình")}</summary>
                    <dl className="mt-2 space-y-1 text-xs">
                      {Object.entries(viewing.settings).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 gap-2">
                          <dt className="break-all text-slate-500">{key}</dt>
                          <dd className="break-all text-slate-300">
                            {value === null || value === undefined
                              ? "—"
                              : typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </>
            ) : (
              <p className="text-slate-500">{error ? t("Không có thông tin về lần chạy này.") : t("Đang tải…")}</p>
            )}
            {viewing && (
              <button
                onClick={retry}
                className="mt-2 block w-full rounded-md border border-emerald-700 py-2 text-center font-semibold text-emerald-300 hover:bg-emerald-950"
              >
                ↻ {t("Chạy lại với cấu hình này")}
              </button>
            )}
            <Link
              href="/run"
              className="mt-2 block rounded-md bg-emerald-600 py-2 text-center font-semibold hover:bg-emerald-500"
            >
              {t("Phân tích mới")}
            </Link>
          </div>
        ) : (
          <>
        <div>
          <label className="label">{t("Danh mục")}</label>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-900 p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`rounded px-2 py-1.5 text-xs ${
                  form.category === c.key ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
                onClick={() => set({ category: c.key, ticker: c.symbols[0], customTicker: false })}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("Mã")}</label>
            <select
              className="field"
              value={form.customTicker ? OTHER : form.ticker}
              onChange={(e) =>
                e.target.value === OTHER
                  ? set({ customTicker: true, ticker: "" })
                  : set({ customTicker: false, ticker: e.target.value })
              }
            >
              {symbols.map((sym) => (
                <option key={sym}>{sym}</option>
              ))}
              <option value={OTHER}>{t("Mã khác…")}</option>
            </select>
            {form.customTicker && (
              <input
                className="field mt-2 uppercase"
                autoFocus
                value={form.ticker}
                onChange={(e) => set({ ticker: e.target.value })}
                placeholder={t(PLACEHOLDER[form.category] ?? "Nhập mã")}
              />
            )}
          </div>
          <div>
            <label className="label">{t("Ngày phân tích")}</label>
            <input type="date" className="field" max={today()} value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">{t("Analyst")}</label>
          <div className="grid grid-cols-2 gap-2">
            {options.analysts.map((a) => (
              <label
                key={a}
                className={`flex items-center gap-2 text-sm ${a === "fundamentals" && noStatements ? "text-slate-600" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={a === "fundamentals" && noStatements}
                  checked={form.analysts.includes(a) && !(a === "fundamentals" && noStatements)}
                  onChange={() => toggleAnalyst(a)}
                />
                {ANALYSTS[a] ? t(ANALYSTS[a].label) : a}
              </label>
            ))}
          </div>
          {noStatements && (
            <p className="mt-1 text-xs text-slate-500">
              {t("Crypto, forex và hàng hoá không có báo cáo tài chính nên bỏ qua analyst Cơ bản.")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("Ngôn ngữ báo cáo")}</label>
            <select className="field" value={form.language} onChange={(e) => set({ language: e.target.value })}>
              {options.languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("Độ sâu")}</label>
            <select className="field" value={form.depth} onChange={(e) => set({ depth: Number(e.target.value) })}>
              {DEPTHS.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{t("Nhà cung cấp LLM")}</label>
          <select className="field" value={form.provider} onChange={(e) => chooseProvider(e.target.value)}>
            {options.providers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
                {p.ready ? "" : ` (${t("chưa có key")})`}
              </option>
            ))}
          </select>
          {provider && !provider.ready && (
            <p className="mt-1 text-xs text-amber-300">
              {provider.key === "chatgpt"
                ? t("Chưa đăng nhập: chạy `tradingagents login chatgpt`.")
                : t("Thiếu {key}: nhập ở ⚙ Cài đặt hoặc file .env ở thư mục gốc.", { key: provider.keyEnv ?? "" })}
            </p>
          )}
        </div>

        {(form.provider === "ollama" || form.provider === "openai_compatible") && (
          <div>
            <label className="label">{t("Địa chỉ server")}</label>
            <input
              className="field"
              value={form.backendUrl}
              onChange={(e) => set({ backendUrl: e.target.value })}
              placeholder="http://localhost:11434/v1"
            />
          </div>
        )}

        {modelPicker("quick", t("Model nhanh (analyst, trader, tranh luận)"))}
        {modelPicker("deep", t("Model sâu (các manager)"))}
        <TestModels
          provider={form.provider}
          quick={form.quick === "custom" ? form.quickCustom : form.quick}
          deep={form.deep === "custom" ? form.deepCustom : form.deep}
          backendUrl={form.backendUrl}
        />

        {running && (
          <button
            className="w-full rounded-md bg-red-600 py-2.5 font-semibold hover:bg-red-500"
            onClick={stop}
          >
            {t("Dừng")} ({elapsed}s)
          </button>
        )}
        <button
          className={`w-full rounded-md py-2.5 font-semibold disabled:opacity-40 ${
            running ? "border border-emerald-700 text-emerald-300 hover:bg-emerald-950" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
          disabled={!canRun}
          onClick={run}
        >
          {running ? `+ ${t("Thêm vào hàng chờ")}` : t("Chạy phân tích")}
        </button>
          </>
        )}
      </aside>

      <section className="min-w-0 space-y-4">
        {viewing && (
          <div className="rounded-md border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm">
            <b>{viewing.ticker}</b>{" "}
            {t("ngày {date}, chạy lúc {time} trong {n} phút", {
              date: viewing.date,
              time: new Date(viewing.startedAt).toLocaleString(locale),
              n: Math.max(1, Math.round((viewing.endedAt - viewing.startedAt) / 60000)),
            })}
          </div>
        )}
        {(running || started || error) && (
          <div className="flex flex-wrap gap-2">
            {stages({ ...form, analysts: runAnalysts }, sections, started && running).map((st) => (
              <span
                key={st.label}
                className={`rounded-full px-3 py-1 text-xs ${
                  st.status === "done"
                    ? "bg-emerald-900 text-emerald-300"
                    : st.status === "running"
                      ? "animate-pulse bg-sky-900 text-sky-300"
                      : "bg-slate-800 text-slate-500"
                }`}
              >
                {st.status === "done" ? "✓ " : st.status === "running" ? "● " : ""}
                {t(st.label)}
              </span>
            ))}
            {usage && (
              <span className="ml-auto rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400" title={t("Token vào / ra")}>
                {t("Token")}: {fmtTokens(usage.total.input)}↑ {fmtTokens(usage.total.output)}↓ ·{" "}
                {t("{n} lượt gọi", { n: usage.total.calls })}
              </span>
            )}
          </div>
        )}

        {error && <div className="rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-200">{t(error)}</div>}
        {notice && <div className="rounded-md border border-sky-800 bg-sky-950/50 p-3 text-sm text-sky-200">{notice}</div>}

        {rating && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-800 bg-slate-900 p-4">
            <span className="text-slate-400">{t("Khuyến nghị:")}</span>
            <span className={`rounded px-3 py-1 text-lg font-bold ${RATING_STYLE[rating] ?? "bg-slate-600"}`}>
              {rating === "REVIEW" ? t("Cần xem lại") : rating}
            </span>
            <Link href="/guide" className="text-xs text-emerald-300 hover:underline">
              {t("Ý nghĩa?")}
            </Link>
            {reportPath && <span className="text-xs break-all text-slate-500">{t("Đã lưu:")} {reportPath}</span>}
          </div>
        )}

        {available.length > 0 ? (
          <div className="rounded-md border border-slate-800 bg-slate-900/60">
            <div className="flex flex-wrap gap-1 border-b border-slate-800 p-2">
              {available.map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded px-3 py-1 text-sm ${k === shownTab ? "bg-emerald-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  {t(l)}
                </button>
              ))}
            </div>
            <article className="report max-w-none p-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sections[shownTab]}</ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-700 p-10 text-center text-slate-500">
            {running
              ? t("Report của từng agent sẽ hiện ở đây khi agent đó viết xong. Theo dõi diễn biến ở cột bên phải.")
              : t("Chọn mã, ngày và model bên trái rồi bấm “Chạy phân tích”.")}
          </div>
        )}
      </section>

      <aside className="flex min-h-80 flex-col rounded-md border border-slate-800 bg-slate-900/60 md:col-span-2 xl:sticky xl:top-22 xl:col-span-1 xl:h-[calc(100vh-7rem)] xl:self-start">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
          <span className="font-semibold">
            {running && <span className="mr-1 animate-pulse text-red-500">●</span>}
            {running ? t("Diễn biến trực tiếp") : t("Diễn biến")}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            {t("Tự cuộn")}
          </label>
        </div>
        <div ref={feedBox} className="max-h-[70vh] flex-1 space-y-3 overflow-y-auto p-4 xl:max-h-none">
          {feed.length === 0 && !running && (
            <p className="text-sm text-slate-500">{t("Các lượt nói và tranh luận của agent sẽ hiện ở đây khi chạy.")}</p>
          )}
          {stages({ ...form, analysts: runAnalysts }, sections, started && running).map((st) => {
            const items = feed.filter((item) => phaseOf(item) === st.label);
            const writing = running ? Object.entries(typing).filter(([s]) => SECTION_PHASE[s] === st.label) : [];
            if (!items.length && !writing.length && st.status !== "running") return null;
            const turns = items.filter((item) => !item.tool).length;
            const fetches = items.length - turns;
            return (
              <details key={st.label} open className="rounded-md border border-slate-800 bg-slate-950/40">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span
                    className={`font-semibold ${
                      st.status === "done" ? "text-emerald-300" : st.status === "running" ? "text-sky-300" : "text-slate-400"
                    }`}
                  >
                    {st.status === "done" ? "✓" : st.status === "running" ? "●" : "○"} {t(st.label)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t("{n} lượt", { n: turns })}
                    {fetches ? ` · ${t("{n} lần lấy dữ liệu", { n: fetches })}` : ""}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-slate-800 p-3">
                  {items.map((item, i) => (
                    <FeedCard key={i} item={item} />
                  ))}
                  {writing.map(([section, text]) => (
                    <TypingCard key={section} section={section} text={text} />
                  ))}
                  {st.status === "running" && !writing.length && (
                    <div className="animate-pulse text-sm text-sky-300">
                      🤔 {t("Đang suy nghĩ…")} {Math.max(0, Math.floor((Date.now() - lastActivity) / 1000))}s
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
