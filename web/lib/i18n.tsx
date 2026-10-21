"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext } from "react";
import { EN } from "./en";
import { LANG_COOKIE, LANGS, type Lang } from "./lang";

const DICTIONARIES: Record<Lang, Record<string, string>> = { vi: {}, en: EN };

const LangContext = createContext<Lang>("vi");

/** The language chosen in the cookie, read by the server so the first render is already in it. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** ``t(text)`` gives the page's language for Vietnamese source text; ``{name}`` slots are filled from ``vars``.
 * Text without a translation shows as written. */
export function useI18n() {
  const lang = useContext(LangContext);
  const dictionary = DICTIONARIES[lang];
  const t = (text: string, vars?: Record<string, string | number>) => {
    let out = dictionary[text] ?? text;
    for (const [key, value] of Object.entries(vars ?? {})) out = out.replaceAll(`{${key}}`, String(value));
    return out;
  };
  return { lang, t, locale: LANGS.find((l) => l.key === lang)!.locale };
}

export function LangSwitch() {
  const { lang } = useI18n();
  const router = useRouter();
  const choose = (next: Lang) => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-700 text-xs">
      {LANGS.map((l) => (
        <button
          key={l.key}
          type="button"
          title={l.label}
          onClick={() => choose(l.key)}
          className={`px-2 py-1 ${lang === l.key ? "bg-emerald-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
        >
          {l.key.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
