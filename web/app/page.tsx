"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, CATEGORY_LABEL, RATING_STYLE, fmtTokens, type RunMeta } from "@/lib/shared";

const STATUS_LABEL = { done: "Hoàn thành", stopped: "Đã dừng", error: "Lỗi" };
const ANALYST_LABEL: Record<string, string> = { market: "Thị trường", social: "Tâm lý", news: "Tin tức", fundamentals: "Cơ bản" };
const minutes = (r: RunMeta) => Math.max(1, Math.round((r.endedAt - r.startedAt) / 60000));
const PAGE_SIZES = [10, 20, 50, 100];
const EMPTY = { source: "", category: "", ticker: "", rating: "", provider: "", model: "", analyst: "", from: "", to: "" };
const isoDate = (d: Date) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time

/** The list opens on analysis dates from one month ago to today. */
function lastMonth() {
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return { ...EMPTY, from: isoDate(from), to: isoDate(new Date()) };
}

type Page = { runs: RunMeta[]; total: number; page: number; pageSize: number };

/** Every saved analysis, newest first, filtered and a page at a time; each opens as it ran. */
export default function Home() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Page | null>(null);
  const [filter, setFilter] = useState(lastMonth);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [choices, setChoices] = useState<{ providers: string[]; models: string[]; jobs: { id: string; name: string }[] }>({
    providers: [],
    models: [],
    jobs: [],
  });
  const [live, setLive] = useState<{ running: boolean; ticker?: string; date?: string }>({ running: false });

  useEffect(() => {
    const query = new URLSearchParams(Object.entries({ ...filter, page: String(page), pageSize: String(pageSize) }).filter(([, v]) => v));
    fetch(`/api/history?${query}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ runs: [], total: 0, page: 1, pageSize }));
  }, [filter, page, pageSize, reload]);

  useEffect(() => {
    fetch("/api/history?choices")
      .then((r) => r.json())
      .then(setChoices)
      .catch(() => {});
    const check = () =>
      fetch("/api/run?status")
        .then((r) => r.json())
        .then(setLive)
        .catch(() => {});
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // A new filter starts again from the first page.
  const set = (patch: Partial<typeof EMPTY>) => {
    setFilter({ ...filter, ...patch });
    setPage(1);
  };
  const filtered = Object.values(filter).some(Boolean);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const open = (r: RunMeta) => `/runs/${encodeURIComponent(r.id)}`;
  const remove = async (r: RunMeta) => {
    if (!confirm(t("Xoá lần chạy lỗi này?"))) return;
    const res = await fetch(`/api/history/${encodeURIComponent(r.id)}`, { method: "DELETE" });
    if (!res.ok) alert(t(await res.text()));
    setReload((n) => n + 1);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {live.running && (
        <Link
          href="/run"
          className="flex items-center justify-between gap-3 rounded-md border border-sky-800 bg-sky-950/40 px-4 py-3 hover:bg-sky-950"
        >
          <span>
            <span className="mr-2 animate-pulse text-red-500">●</span>
            {t("Đang phân tích")} <b>{live.ticker}</b> · {live.date}
          </span>
          <span className="text-sm text-sky-300">{t("Xem trực tiếp")} →</span>
        </Link>
      )}

      <section className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            {t("Các lần phân tích")} {data && <span className="text-slate-500">({data.total})</span>}
          </h1>
          <p className="text-sm text-slate-400">{t("Nhóm agent LLM phân tích và ra quyết định giao dịch")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 md:grid-cols-4 lg:grid-cols-10">
          <select className="field" value={filter.source} onChange={(e) => set({ source: e.target.value })}>
            <option value="">{t("Mọi nguồn")}</option>
            <option value="manual">{t("Thủ công")}</option>
            {choices.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                ⏰ {j.name}
              </option>
            ))}
          </select>
          <select className="field" value={filter.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{t("Mọi danh mục")}</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {t(c.label)}
              </option>
            ))}
          </select>
          <input className="field" placeholder={t("Mã")} value={filter.ticker} onChange={(e) => set({ ticker: e.target.value })} />
          <select className="field" value={filter.rating} onChange={(e) => set({ rating: e.target.value })}>
            <option value="">{t("Mọi kết quả")}</option>
            {["Buy", "Overweight", "Hold", "Underweight", "Sell", "REVIEW"].map((r) => (
              <option key={r}>{r}</option>
            ))}
            <option value="stopped">{t("Đã dừng")}</option>
            <option value="error">{t("Lỗi")}</option>
          </select>
          <select className="field" value={filter.provider} onChange={(e) => set({ provider: e.target.value })}>
            <option value="">{t("Mọi nhà cung cấp")}</option>
            {choices.providers.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="field" value={filter.model} onChange={(e) => set({ model: e.target.value })}>
            <option value="">{t("Mọi model")}</option>
            {choices.models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select className="field" value={filter.analyst} onChange={(e) => set({ analyst: e.target.value })}>
            <option value="">{t("Mọi analyst")}</option>
            {Object.entries(ANALYST_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {t("Có {name}", { name: t(l) })}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="field"
            title={t("Ngày phân tích từ")}
            value={filter.from}
            onChange={(e) => set({ from: e.target.value })}
          />
          <input
            type="date"
            className="field"
            title={t("Ngày phân tích đến")}
            value={filter.to}
            onChange={(e) => set({ to: e.target.value })}
          />
          <button
            className="rounded-md border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            disabled={!filtered}
            onClick={() => set(EMPTY)}
          >
            {t("Xoá bộ lọc")}
          </button>
        </div>

        {data === null ? (
          <p className="text-slate-500">{t("Đang tải…")}</p>
        ) : data.runs.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-700 p-10 text-center text-slate-500">
            {filtered
              ? t("Không có lần phân tích nào khớp bộ lọc.")
              : t("Chưa có lần phân tích nào. Bấm “Phân tích mới” để bắt đầu.")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-2">{t("Thời gian chạy")}</th>
                  <th className="px-4 py-2">{t("Mã")}</th>
                  <th className="px-4 py-2">{t("Nguồn")}</th>
                  <th className="px-4 py-2">{t("Danh mục")}</th>
                  <th className="px-4 py-2">{t("Ngày phân tích")}</th>
                  <th className="px-4 py-2">{t("Kết quả")}</th>
                  <th className="px-4 py-2">Analyst</th>
                  <th className="px-4 py-2">{t("Nhà cung cấp / model")}</th>
                  <th className="px-4 py-2 text-right">{t("Token")}</th>
                  <th className="px-4 py-2 text-right">{t("Thời lượng")}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-900">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={open(r)} className="block">
                        {new Date(r.startedAt).toLocaleString(locale)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      <Link href={open(r)} className="block text-emerald-300 hover:underline">
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {r.source?.type === "job" ? (
                        <span title={r.source.attempt ? t("lần thử {n}", { n: r.source.attempt + 1 }) : undefined}>
                          ⏰ {r.source.jobName}
                          {r.source.attempt ? ` ↻${r.source.attempt}` : ""}
                        </span>
                      ) : (
                        t("Thủ công")
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{CATEGORY_LABEL[r.category ?? ""] ? t(CATEGORY_LABEL[r.category ?? ""]) : "—"}</td>
                    <td className="px-4 py-2">{r.date}</td>
                    <td className="px-4 py-2">
                      {r.status === "done" ? (
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${RATING_STYLE[r.rating ?? ""] ?? "bg-slate-600"}`}>
                          {r.rating}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{t(STATUS_LABEL[r.status])}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {r.analysts.map((a) => (ANALYST_LABEL[a] ? t(ANALYST_LABEL[a]) : a)).join(", ")}
                    </td>
                    <td className="max-w-64 px-4 py-2 text-slate-400">
                      <div>{r.provider}</div>
                      <div className="truncate text-xs" title={`${t("nhanh")}: ${r.quick} · ${t("sâu")}: ${r.deep}`}>
                        {r.quick === r.deep ? r.quick : `${r.quick} · ${r.deep}`}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap text-slate-400" title={t("Token vào / ra")}>
                      {r.usage ? `${fmtTokens(r.usage.total.input)}↑ ${fmtTokens(r.usage.total.output)}↓` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">{t("{n} phút", { n: minutes(r) })}</td>
                    <td className="px-4 py-2 text-right">
                      {r.status === "error" && (
                        <button onClick={() => remove(r)} className="text-xs text-rose-400 hover:text-rose-300 hover:underline">
                          {t("Xoá")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <span>
              {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} / {data.total}
            </span>
            <div className="flex items-center gap-2">
              <select
                className="field w-auto"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {t("{n} / trang", { n })}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 whitespace-nowrap hover:bg-slate-800 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ← {t("Trước")}
              </button>
              <span className="whitespace-nowrap">
                {t("Trang {page} / {pages}", { page: data.page, pages })}
              </span>
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 whitespace-nowrap hover:bg-slate-800 disabled:opacity-40"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t("Sau")} →
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
