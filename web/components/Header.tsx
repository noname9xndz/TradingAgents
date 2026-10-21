"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LangSwitch, useI18n } from "@/lib/i18n";

const NAV: [string, string][] = [
  ["/", "Lịch sử phân tích"],
  ["/queue", "Hàng chờ"],
  ["/jobs", "Lịch chạy"],
  ["/guide", "Hướng dẫn"],
  ["/settings", "Cài đặt"],
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-emerald-600" />
      <path d="M9 9v14M16 6v20M23 11v10" className="stroke-emerald-950" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="12" width="4" height="7" rx="1" className="fill-emerald-100" />
      <rect x="14" y="9" width="4" height="10" rx="1" className="fill-emerald-100" />
      <rect x="21" y="13" width="4" height="5" rx="1" className="fill-emerald-100" />
    </svg>
  );
}

/** The bar on every page: where you are, where you can go, and whether an analysis is running. */
export default function Header() {
  const { t } = useI18n();
  const path = usePathname();
  const [live, setLive] = useState<{ running: boolean; ticker?: string; waiting?: number }>({ running: false });

  useEffect(() => {
    const check = () =>
      fetch("/api/run?status")
        .then((r) => r.json())
        .then(setLive)
        .catch(() => {});
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/runs/") : path.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo />
          <span className="hidden leading-tight sm:block">
            <span className="block font-bold tracking-tight text-slate-100">TradingAgents</span>
            <span className="block text-[11px] text-slate-500">{t("Phân tích đa agent")}</span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 whitespace-nowrap transition-colors ${
                active(href) ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {href === "/settings" ? "⚙ " : ""}
              {t(label)}
              {href === "/queue" && live.waiting ? (
                <span className="ml-1.5 rounded-full bg-emerald-700 px-1.5 text-[11px] text-white">{live.waiting}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {live.running && (
            <Link
              href="/run"
              className="hidden items-center gap-2 rounded-full border border-sky-800 bg-sky-950/60 px-3 py-1 text-xs text-sky-200 hover:bg-sky-900 md:flex"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {t("Đang phân tích")} <b>{live.ticker}</b>
            </Link>
          )}
          <LangSwitch />
          <Link
            href="/run"
            className={`rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              path === "/run" ? "bg-emerald-700 text-white" : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            + {t("Phân tích mới")}
          </Link>
        </div>
      </div>
    </header>
  );
}
