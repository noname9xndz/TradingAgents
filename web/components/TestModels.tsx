"use client";

import { useState } from "react";
import { ERROR_KINDS, type ErrorKind } from "@/lib/error-kinds";
import { useI18n } from "@/lib/i18n";

type Result = { tier: "quick" | "deep"; model: string; ok: boolean; ms: number; reply?: string; error?: string; kind?: ErrorKind };

/** "Test connection": calls the chosen quick and deep models once and shows which answered. */
export default function TestModels({ provider, quick, deep, backendUrl }: { provider?: string; quick?: string; deep?: string; backendUrl?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<{ message: string; kind?: ErrorKind } | null>(null);
  const ready = Boolean(provider && quick?.trim() && deep?.trim());

  async function test() {
    setBusy(true);
    setResults(null);
    setError(null);
    try {
      const res = await fetch("/api/test-model", { method: "POST", body: JSON.stringify({ provider, quick, deep, backendUrl }) });
      const body = await res.json();
      if (!res.ok) setError({ message: t(body.error), kind: body.kind });
      else setResults(body.results);
    } catch (err) {
      setError({ message: String(err) });
    } finally {
      setBusy(false);
    }
  }

  const failure = (message: string, kind?: ErrorKind) => {
    const [label, hint] = ERROR_KINDS[kind ?? "other"];
    return (
      <div className="space-y-0.5">
        <div className="text-red-300">
          ❌ {t(label)}: <span className="break-words text-slate-300">{message.slice(0, 300)}</span>
        </div>
        <div className="text-slate-500">💡 {t(hint)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rounded-md border border-sky-800 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-950 disabled:opacity-40"
        disabled={!ready || busy}
        onClick={test}
      >
        {busy ? t("Đang gọi model… (model miễn phí có thể mất tới 1–2 phút)") : `🔌 ${t("Kiểm tra kết nối model")}`}
      </button>
      {error && <div className="text-xs">{failure(error.message, error.kind)}</div>}
      {results && (
        <ul className="space-y-1.5 text-xs">
          {results.map((r) => (
            <li key={r.tier}>
              <span className="text-slate-400">{r.tier === "quick" ? t("Model nhanh") : t("Model sâu")}</span>{" "}
              <code className="text-slate-300">{r.model}</code>
              {r.ok ? (
                <span className="text-emerald-300">
                  {" "}
                  ✅ {t("gọi được")} · {(r.ms / 1000).toFixed(1)}s
                </span>
              ) : (
                failure(r.error ?? "", r.kind)
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
