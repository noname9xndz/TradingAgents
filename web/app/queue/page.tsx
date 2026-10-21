"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Source = { type: string; jobName?: string; attempt?: number };
type Waiting = { id: string; ticker: string; date: string; provider: string; quick: string; source: Source; enqueuedAt: number };
type Queue = { running: { ticker: string; date: string; source: Source } | null; waiting: Waiting[] };

/** The line of analyses: the one running, then the ones waiting, run one at a time. Kept in the database. */
export default function QueuePage() {
  const { t, locale } = useI18n();
  const [queue, setQueue] = useState<Queue | null>(null);

  const load = () =>
    fetch("/api/queue")
      .then((r) => r.json())
      .then(setQueue)
      .catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const origin = (s: Source) =>
    `${s.type === "job" ? `⏰ ${s.jobName}` : t("Thủ công")}${s.attempt ? ` · ${t("lần thử {n}", { n: s.attempt + 1 })}` : ""}`;
  const remove = async (id: string) => {
    await fetch(`/api/queue/${id}`, { method: "DELETE" });
    load();
  };
  const stop = async () => {
    if (!window.confirm(t("Dừng lượt đang chạy?"))) return;
    await fetch("/api/run", { method: "DELETE" });
    load();
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">{t("Hàng chờ")}</h1>
        <p className="text-sm text-slate-400">
          {t("Các mã chạy lần lượt, mỗi lúc một mã. Hàng chờ được lưu trong DB nên không mất khi khởi động lại server; mã nào xong sẽ được xoá khỏi hàng chờ.")}
        </p>
      </div>

      {!queue ? (
        <p className="text-slate-400">{t("Đang tải…")}</p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">{t("Đang chạy")}</h2>
            {queue.running ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-800 bg-sky-950/40 px-4 py-3 text-sm">
                <span>
                  <span className="mr-2 animate-pulse text-red-500">●</span>
                  <b>{queue.running.ticker}</b>{" "}
                  <span className="text-slate-400">
                    · {queue.running.date} · {origin(queue.running.source)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Link href="/run" className="rounded-md bg-sky-700 px-3 py-1 text-xs hover:bg-sky-600">
                    {t("Xem trực tiếp")}
                  </Link>
                  <button className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950" onClick={stop}>
                    {t("Dừng")}
                  </button>
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("Không có mã nào đang chạy.")}</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">
              {t("Đang chờ")} <span className="text-slate-500">({queue.waiting.length})</span>
            </h2>
            {queue.waiting.length === 0 ? (
              <p className="text-sm text-slate-500">{t("Không có mã nào đang chờ.")}</p>
            ) : (
              <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
                {queue.waiting.map((q, i) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span>
                      <span className="mr-3 text-slate-500">#{i + 1}</span>
                      <b>{q.ticker}</b>{" "}
                      <span className="text-slate-400">
                        · {q.date} · {origin(q.source)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {q.provider} · {q.quick} · {t("thêm lúc {time}", { time: new Date(q.enqueuedAt).toLocaleString(locale) })}
                      </span>
                    </span>
                    <button className="text-xs text-red-300 hover:underline" onClick={() => remove(q.id)}>
                      {t("Bỏ khỏi hàng đợi")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
