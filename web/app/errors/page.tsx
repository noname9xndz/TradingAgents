"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ERROR_KINDS, type ErrorKind } from "@/lib/error-kinds";
import { useI18n } from "@/lib/i18n";

type ErrorRow = {
  id: number;
  at: number;
  scope: string;
  kind: string;
  message: string;
  detail?: string | null;
  runId?: string | null;
  ticker?: string | null;
  jobName?: string | null;
};
type Page = { errors: ErrorRow[]; total: number; page: number; pageSize: number };

const SCOPES: Record<string, string> = {
  run: "Phân tích",
  scheduler: "Lịch chạy",
  queue: "Hàng chờ",
  history: "Lưu lịch sử",
  telegram: "Telegram",
};
const KIND_STYLE: Record<string, string> = {
  model: "bg-amber-800",
  auth: "bg-red-800",
  quota: "bg-red-800",
  rate: "bg-sky-800",
  network: "bg-sky-800",
  data: "bg-violet-800",
  process: "bg-slate-600",
  other: "bg-slate-700",
};

/** Every recorded error, newest first: what failed, what kind of failure, and what to do. */
export default function ErrorsPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Page | null>(null);
  const [scope, setScope] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(Object.entries({ scope, kind, page: String(page) }).filter(([, v]) => v));
    fetch(`/api/errors?${q}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ errors: [], total: 0, page: 1, pageSize: 50 }));
  }, [scope, kind, page, reload]);

  const clear = async () => {
    if (!window.confirm(t("Xoá toàn bộ nhật ký lỗi?"))) return;
    await fetch("/api/errors", { method: "DELETE" });
    setPage(1);
    setReload((n) => n + 1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{t("Nhật ký lỗi")}</h1>
          <p className="text-sm text-slate-400">{t("Các lần phân tích lỗi và lỗi của server (lịch chạy, hàng chờ, Telegram), lưu trong DB.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="field w-auto" value={scope} onChange={(e) => (setScope(e.target.value), setPage(1))}>
            <option value="">{t("Mọi nơi")}</option>
            {Object.entries(SCOPES).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={kind} onChange={(e) => (setKind(e.target.value), setPage(1))}>
            <option value="">{t("Mọi loại lỗi")}</option>
            {Object.entries(ERROR_KINDS).map(([k, [label]]) => (
              <option key={k} value={k}>
                {t(label)}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-40" disabled={!data?.total} onClick={clear}>
            {t("Xoá nhật ký")}
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-slate-400">{t("Đang tải…")}</p>
      ) : data.errors.length === 0 ? (
        <p className="rounded-md border border-slate-800 p-8 text-center text-sm text-slate-500">{t("Không có lỗi nào.")}</p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
          {data.errors.map((e) => {
            const [label, hint] = ERROR_KINDS[e.kind as ErrorKind] ?? ERROR_KINDS.other;
            return (
              <li key={e.id} className="space-y-1.5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="whitespace-nowrap text-slate-400">{new Date(e.at).toLocaleString(locale)}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[e.kind] ?? "bg-slate-700"}`}>{t(label)}</span>
                  <span className="text-xs text-slate-400">{t(SCOPES[e.scope] ?? e.scope)}</span>
                  {e.ticker && <b>{e.ticker}</b>}
                  {e.jobName && <span className="text-xs text-slate-400">⏰ {e.jobName}</span>}
                  {e.runId && (
                    <Link href={`/runs/${encodeURIComponent(e.runId)}`} className="text-xs text-emerald-300 hover:underline">
                      {t("Mở lần chạy")} →
                    </Link>
                  )}
                </div>
                <div className="break-words text-slate-200">{e.message}</div>
                <div className="text-xs text-slate-500">💡 {t(hint)}</div>
                {e.detail && (
                  <>
                    <button className="text-xs text-slate-400 hover:underline" onClick={() => setOpen(open === e.id ? null : e.id)}>
                      {open === e.id ? t("Ẩn chi tiết") : t("Xem chi tiết")}
                    </button>
                    {open === e.id && (
                      <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap text-slate-400">{e.detail}</pre>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
          <button className="rounded border border-slate-700 px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ←
          </button>
          {page} / {pages}
          <button className="rounded border border-slate-700 px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            →
          </button>
        </div>
      )}
    </main>
  );
}
