"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Schedule } from "@/lib/schedule";
import { CATEGORIES, RATING_STYLE } from "@/lib/shared";

type ModelList = [string, string][];
type Options = {
  providers: { key: string; label: string; url: string | null; ready: boolean }[];
  models: Record<string, { quick: ModelList; deep: ModelList }>;
  analysts: string[];
  languages: string[];
};
type Job = {
  id: string;
  name: string;
  enabled: boolean;
  symbols: { category: string; ticker: string }[];
  request: { analysts: string[]; language: string; depth: number; provider: string; quick: string; deep: string; backendUrl?: string };
  schedule: Schedule;
  retries: number;
  lastRunAt?: number;
  nextRunAt?: number | null;
};
type Fire = {
  id: string;
  jobName: string;
  firedAt: number;
  trigger: "schedule" | "manual";
  symbols: { ticker: string; status: string; rating?: string | null; runId?: string; attempt?: number }[];
};

const SYMBOL_STATUS: Record<string, [string, string]> = {
  running: ["đang chạy", "border-sky-700 text-sky-300"],
  queued: ["đang chờ", "border-slate-600 text-slate-300"],
  error: ["lỗi", "border-red-800 text-red-300"],
  stopped: ["đã dừng", "border-amber-800 text-amber-300"],
  dropped: ["không chạy", "border-slate-700 text-slate-500"],
};
const ANALYST_LABEL: Record<string, string> = { market: "Thị trường", social: "Tâm lý", news: "Tin tức", fundamentals: "Cơ bản" };
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DEPTHS: [number, string][] = [
  [1, "Nông: nhanh, ít vòng tranh luận"],
  [3, "Trung bình"],
  [5, "Sâu: tranh luận kỹ"],
];

/** A model as the picker shows it: a listed id, or "custom" with the id typed in. */
function pick(list: ModelList = [], id?: string): [string, string] {
  if (!id) return [list.find(([, v]) => v !== "custom")?.[1] ?? "custom", ""];
  return list.some(([, v]) => v === id) ? [id, ""] : ["custom", id];
}

function blankJob(options: Options, defaults: Record<string, any>): Job {
  const provider = defaults.provider && options.models[defaults.provider] ? defaults.provider : options.providers[0]?.key;
  return {
    id: "",
    name: "",
    enabled: true,
    symbols: [],
    request: {
      analysts: defaults.analysts ?? ["market", "news"],
      language: defaults.language ?? "Vietnamese",
      depth: defaults.depth ?? 1,
      provider,
      quick: defaults.quick ?? pick(options.models[provider]?.quick)[0],
      deep: defaults.deep ?? pick(options.models[provider]?.deep)[0],
      backendUrl: defaults.backendUrl ?? options.providers.find((p) => p.key === provider)?.url ?? "",
    },
    schedule: { type: "daily", time: "08:00" },
    retries: 1,
  };
}

export default function JobsPage() {
  const { t, locale } = useI18n();
  const [options, setOptions] = useState<Options | null>(null);
  const [defaults, setDefaults] = useState<Record<string, any>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<Fire[]>([]);
  const [editing, setEditing] = useState<Job | null>(null);
  const [quick, setQuick] = useState<[string, string]>(["", ""]);
  const [deep, setDeep] = useState<[string, string]>(["", ""]);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");

  const load = () =>
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => {
        setJobs(d.jobs);
        setHistory(d.history);
      });

  useEffect(() => {
    Promise.all([fetch("/api/options").then((r) => r.json()), fetch("/api/settings").then((r) => r.json())]).then(([o, s]) => {
      setOptions(o);
      setDefaults(s.defaults ?? {});
    });
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  if (!options) return <main className="p-8 text-slate-400">{t("Đang tải…")}</main>;

  const when = (ms?: number | null) => (ms ? new Date(ms).toLocaleString(locale) : "—");
  const describe = (s: Schedule) =>
    s.type === "once"
      ? t("Một lần lúc {time}", { time: new Date(s.at).toLocaleString(locale) })
      : s.type === "daily"
        ? t("Hằng ngày lúc {time}", { time: s.time })
        : s.type === "weekly"
          ? t("{days} lúc {time}", { days: s.days.map((d) => t(DAYS[d])).join(", "), time: s.time })
          : t("Mỗi {n} giờ", { n: s.everyHours });

  function open(job: Job) {
    setEditing(job);
    setQuick(pick(options!.models[job.request.provider]?.quick, job.request.quick));
    setDeep(pick(options!.models[job.request.provider]?.deep, job.request.deep));
    setCustom("");
    setMessage("");
  }

  async function save() {
    if (!editing) return;
    const extra = custom
      .split(/[\s,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .map((ticker) => ({ category: guessCategory(ticker), ticker }));
    const body = {
      ...editing,
      symbols: [...editing.symbols, ...extra.filter((e) => !editing.symbols.some((s) => s.ticker === e.ticker))],
      request: {
        ...editing.request,
        quick: quick[0] === "custom" ? quick[1].trim() : quick[0],
        deep: deep[0] === "custom" ? deep[1].trim() : deep[0],
      },
    };
    const res = await fetch(editing.id ? `/api/jobs/${editing.id}` : "/api/jobs", {
      method: editing.id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!res.ok) return setMessage(t(out.error ?? "Không lưu được."));
    setEditing(null);
    load();
  }

  const act = async (url: string, method: string, body?: unknown) => {
    await fetch(url, { method, body: body ? JSON.stringify(body) : undefined });
    load();
  };

  const e = editing;
  const setReq = (patch: Partial<Job["request"]>) => e && setEditing({ ...e, request: { ...e.request, ...patch } });
  const setSchedule = (schedule: Schedule) => e && setEditing({ ...e, schedule });
  const toggleSymbol = (category: string, ticker: string) =>
    e &&
    setEditing({
      ...e,
      symbols: e.symbols.some((s) => s.ticker === ticker)
        ? e.symbols.filter((s) => s.ticker !== ticker)
        : [...e.symbols, { category, ticker }],
    });
  const models = e ? (options.models[e.request.provider] ?? { quick: [], deep: [] }) : { quick: [], deep: [] };
  const modelPicker = (label: string, list: ModelList, value: [string, string], set: (v: [string, string]) => void) => (
    <div>
      <label className="label">{label}</label>
      <select className="field" value={value[0]} onChange={(ev) => set([ev.target.value, value[1]])}>
        {list.map(([l, v]) => (
          <option key={v} value={v}>
            {v === "custom" ? t("Nhập model ID khác…") : l}
          </option>
        ))}
      </select>
      {value[0] === "custom" && (
        <input className="field mt-2" placeholder="model ID" value={value[1]} onChange={(ev) => set(["custom", ev.target.value])} />
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{t("Lịch chạy")}</h1>
          <p className="text-sm text-slate-400">
            {t("Tự động phân tích một danh sách mã theo lịch. Các mã chạy lần lượt, mỗi lúc một mã.")}
          </p>
        </div>
        <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500" onClick={() => open(blankJob(options, defaults))}>
          + {t("Tạo job")}
        </button>
      </div>

      {e && (
        <section className="space-y-4 rounded-md border border-emerald-800 bg-slate-900/80 p-5">
          <h2 className="font-semibold">{e.id ? t("Sửa job") : t("Job mới")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">{t("Tên job")}</label>
              <input className="field" value={e.name} onChange={(ev) => setEditing({ ...e, name: ev.target.value })} placeholder={t("VD: Vàng và crypto buổi sáng")} />
            </div>
            <div>
              <label className="label">{t("Tự chạy lại mã lỗi")}</label>
              <select className="field" value={e.retries} onChange={(ev) => setEditing({ ...e, retries: Number(ev.target.value) })}>
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? t("Không") : t("Tối đa {n} lần", { n })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{t("Mã")}</label>
            <div className="space-y-2">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-xs text-slate-400">{t(c.label)}</span>
                  {c.symbols.map((sym) => {
                    const on = e.symbols.some((s) => s.ticker === sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymbol(c.key, sym)}
                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-emerald-500 bg-emerald-800 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              ))}
              {e.symbols.filter((s) => !CATEGORIES.some((c) => c.symbols.includes(s.ticker))).length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-xs text-slate-400">{t("Mã khác")}</span>
                  {e.symbols
                    .filter((s) => !CATEGORIES.some((c) => c.symbols.includes(s.ticker)))
                    .map((s) => (
                      <button key={s.ticker} type="button" onClick={() => toggleSymbol(s.category, s.ticker)} className="rounded-full border border-emerald-500 bg-emerald-800 px-3 py-1 text-xs">
                        {s.ticker} ✕
                      </button>
                    ))}
                </div>
              )}
              <input className="field" value={custom} onChange={(ev) => setCustom(ev.target.value)} placeholder={t("Thêm mã khác, cách nhau bởi dấu phẩy: 0700.HK, SOLUSDT")} />
            </div>
          </div>

          <div>
            <label className="label">{t("Lịch")}</label>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                className="field"
                value={e.schedule.type}
                onChange={(ev) => {
                  const type = ev.target.value;
                  setSchedule(
                    type === "once"
                      ? { type, at: new Date(Date.now() + 3_600_000).toLocaleString("sv-SE").slice(0, 16).replace(" ", "T") }
                      : type === "weekly"
                        ? { type, time: "08:00", days: [1, 2, 3, 4, 5] }
                        : type === "interval"
                          ? { type, everyHours: 6 }
                          : { type: "daily", time: "08:00" },
                  );
                }}
              >
                <option value="once">{t("Một lần")}</option>
                <option value="daily">{t("Hằng ngày")}</option>
                <option value="weekly">{t("Các ngày trong tuần")}</option>
                <option value="interval">{t("Mỗi N giờ")}</option>
              </select>
              {e.schedule.type === "once" && (
                <input type="datetime-local" className="field" value={e.schedule.at} onChange={(ev) => setSchedule({ type: "once", at: ev.target.value })} />
              )}
              {(e.schedule.type === "daily" || e.schedule.type === "weekly") && (
                <input
                  type="time"
                  className="field"
                  value={e.schedule.time}
                  onChange={(ev) => setSchedule({ ...(e.schedule as { type: "daily"; time: string }), time: ev.target.value })}
                />
              )}
              {e.schedule.type === "interval" && (
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="field"
                  value={e.schedule.everyHours}
                  onChange={(ev) => setSchedule({ type: "interval", everyHours: Number(ev.target.value) })}
                />
              )}
            </div>
            {e.schedule.type === "weekly" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map((d, i) => {
                  const s = e.schedule as { type: "weekly"; time: string; days: number[] };
                  const on = s.days.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSchedule({ ...s, days: on ? s.days.filter((x) => x !== i) : [...s.days, i].sort() })}
                      className={`rounded-md border px-3 py-1 text-xs ${on ? "border-emerald-500 bg-emerald-800" : "border-slate-700 text-slate-300"}`}
                    >
                      {t(d)}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">{t("Theo giờ của máy chạy server. Ngày phân tích là ngày chạy.")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">{t("Analyst")}</label>
              <div className="flex flex-wrap gap-4">
                {options.analysts.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={e.request.analysts.includes(a)}
                      onChange={() =>
                        setReq({
                          analysts: e.request.analysts.includes(a) ? e.request.analysts.filter((x) => x !== a) : [...e.request.analysts, a],
                        })
                      }
                    />
                    {t(ANALYST_LABEL[a] ?? a)}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("Crypto, forex và hàng hoá không có báo cáo tài chính nên bỏ qua analyst Cơ bản.")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("Ngôn ngữ báo cáo")}</label>
                <select className="field" value={e.request.language} onChange={(ev) => setReq({ language: ev.target.value })}>
                  {options.languages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("Độ sâu")}</label>
                <select className="field" value={e.request.depth} onChange={(ev) => setReq({ depth: Number(ev.target.value) })}>
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
              <select
                className="field"
                value={e.request.provider}
                onChange={(ev) => {
                  const key = ev.target.value;
                  setReq({ provider: key, backendUrl: options.providers.find((p) => p.key === key)?.url ?? "" });
                  setQuick(pick(options.models[key]?.quick));
                  setDeep(pick(options.models[key]?.deep));
                }}
              >
                {options.providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                    {p.ready ? "" : ` (${t("chưa có key")})`}
                  </option>
                ))}
              </select>
            </div>
            {(e.request.provider === "ollama" || e.request.provider === "openai_compatible") && (
              <div>
                <label className="label">{t("Địa chỉ server")}</label>
                <input className="field" value={e.request.backendUrl ?? ""} onChange={(ev) => setReq({ backendUrl: ev.target.value })} />
              </div>
            )}
            {modelPicker(t("Model nhanh (analyst, trader, tranh luận)"), models.quick, quick, setQuick)}
            {modelPicker(t("Model sâu (các manager)"), models.deep, deep, setDeep)}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={e.enabled} onChange={(ev) => setEditing({ ...e, enabled: ev.target.checked })} />
              {t("Bật lịch")}
            </label>
            <button className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold hover:bg-emerald-500" onClick={save}>
              {t("Lưu")}
            </button>
            <button className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800" onClick={() => setEditing(null)}>
              {t("Huỷ")}
            </button>
            {message && <span className="text-sm text-red-300">{message}</span>}
          </div>
        </section>
      )}

      <section className="overflow-x-auto rounded-md border border-slate-800">
        {jobs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{t("Chưa có job nào. Bấm “Tạo job” để lên lịch phân tích tự động.")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-2">{t("Job")}</th>
                <th className="px-4 py-2">{t("Mã")}</th>
                <th className="px-4 py-2">{t("Lịch")}</th>
                <th className="px-4 py-2">{t("Lần tới")}</th>
                <th className="px-4 py-2">{t("Lần trước")}</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-800 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{job.name}</div>
                    <div className="text-xs text-slate-500">
                      {job.request.provider} · {job.request.quick}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{job.symbols.map((s) => s.ticker).join(", ")}</td>
                  <td className="px-4 py-3 text-slate-300">{describe(job.schedule)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {job.enabled ? when(job.nextRunAt) : <span className="text-slate-500">{t("Đã tắt")}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400">{when(job.lastRunAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <button className="rounded-md bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600" onClick={() => act(`/api/jobs/${job.id}/run`, "POST")}>
                        ▶ {t("Chạy ngay")}
                      </button>
                      <button
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
                        onClick={() => act(`/api/jobs/${job.id}`, "PUT", { ...job, enabled: !job.enabled })}
                      >
                        {job.enabled ? t("Tắt") : t("Bật")}
                      </button>
                      <button className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800" onClick={() => open(job)}>
                        {t("Sửa")}
                      </button>
                      <button
                        className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                        onClick={() => window.confirm(t("Xoá job “{name}”?", { name: job.name })) && act(`/api/jobs/${job.id}`, "DELETE")}
                      >
                        {t("Xoá")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{t("Lịch sử chạy job")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">{t("Job chưa chạy lần nào.")}</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
            {history.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
                <span className="w-44 whitespace-nowrap text-slate-300">{when(f.firedAt)}</span>
                <span className="w-48">
                  <b>{f.jobName}</b> <span className="text-xs text-slate-500">· {f.trigger === "schedule" ? t("theo lịch") : t("chạy tay")}</span>
                </span>
                <span className="flex flex-1 flex-wrap gap-2">
                  {f.symbols.map((s) => {
                    const retry = s.attempt ? ` ↻${s.attempt}` : "";
                    if (s.status === "done" && s.runId)
                      return (
                        <Link key={s.ticker} href={`/runs/${encodeURIComponent(s.runId)}`} className={`rounded px-2 py-0.5 text-xs font-bold hover:opacity-80 ${RATING_STYLE[s.rating ?? ""] ?? "bg-slate-600"}`}>
                          {s.ticker} · {s.rating}
                          {retry}
                        </Link>
                      );
                    const [label, style] = SYMBOL_STATUS[s.status] ?? [s.status, "border-slate-700"];
                    const chip = `rounded border px-2 py-0.5 text-xs ${style}`;
                    const text = `${s.ticker} · ${t(label)}${retry}`;
                    return s.runId ? (
                      <Link key={s.ticker} href={`/runs/${encodeURIComponent(s.runId)}`} className={`${chip} hover:underline`}>
                        {text}
                      </Link>
                    ) : (
                      <span key={s.ticker} className={chip}>
                        {text}
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** The category a typed symbol most likely belongs to, for the history's category column. */
function guessCategory(ticker: string) {
  const listed = CATEGORIES.find((c) => c.symbols.includes(ticker));
  if (listed) return listed.key;
  if (/USDT$|USDC$|-USD$/.test(ticker)) return "crypto";
  if (/=X$|=F$|^(XAU|XAG|XPT|XPD)|OIL$|^[A-Z]{6}$/.test(ticker)) return "forex";
  return "stock";
}
