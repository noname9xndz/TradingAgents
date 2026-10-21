"use client";

import { useI18n } from "@/lib/i18n";

/** Placeholder until backtesting is built. */
export default function BacktestPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-xl font-semibold text-slate-100">Backtest</h1>
      <div className="mt-6 rounded-md border border-dashed border-slate-700 p-12 text-center text-slate-400">
        🚧 {t("Tính năng đang phát triển.")}
      </div>
    </main>
  );
}
