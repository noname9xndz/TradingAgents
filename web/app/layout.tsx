import type { Metadata } from "next";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import { LangProvider } from "@/lib/i18n";
import { LANG_COOKIE, toLang } from "@/lib/lang";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradingAgents",
  description: "Multi-agent LLM trading analysis",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = toLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    // Browser extensions add attributes to <html> and <body> before React loads.
    <html lang={lang} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LangProvider lang={lang}>
          <Header />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
