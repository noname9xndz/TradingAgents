"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type ModelList = [string, string][];
type Provider = {
  key: string;
  label: string;
  url: string | null;
  keyEnv: string | null;
  ready: boolean;
};
type Options = {
  providers: Provider[];
  models: Record<string, { quick: ModelList; deep: ModelList }>;
  analysts: string[];
  languages: string[];
};
type Defaults = {
  provider?: string;
  quick?: string;
  deep?: string;
  backendUrl?: string;
  language?: string;
  depth?: number;
  analysts?: string[];
};

// Keys the data vendors read, besides the LLM providers'.
const DATA_KEYS: [string, string][] = [
  ["FRED_API_KEY", "FRED (lãi suất, lạm phát, vĩ mô) — miễn phí"],
  ["ALPHA_VANTAGE_API_KEY", "Alpha Vantage (giá, báo cáo tài chính)"],
  ["TYPESAFE_API_KEY", "TypeSafe Jev (lọc bài StockTwits/Reddit)"],
  [
    "SEC_EDGAR_USER_AGENT",
    "SEC EDGAR: tên và email liên hệ, ví dụ “Ten Ban ban@email.com”",
  ],
];
const ANALYST_LABEL: Record<string, string> = {
  market: "Thị trường",
  social: "Tâm lý",
  news: "Tin tức",
  fundamentals: "Cơ bản",
};
const DEPTHS: [number, string][] = [
  [1, "Nông: nhanh, ít vòng tranh luận"],
  [3, "Trung bình"],
  [5, "Sâu: tranh luận kỹ"],
];

/** A model choice as the picker shows it: a listed id, or "custom" with the id typed in. */
function pick(list: ModelList = [], id?: string): [string, string] {
  if (!id) return [list.find(([, v]) => v !== "custom")?.[1] ?? "custom", ""];
  return list.some(([, v]) => v === id) ? [id, ""] : ["custom", id];
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [options, setOptions] = useState<Options | null>(null);
  const [masked, setMasked] = useState<Record<string, string>>({});
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Defaults>({});
  const [quick, setQuick] = useState<[string, string]>(["", ""]);
  const [deep, setDeep] = useState<[string, string]>(["", ""]);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"general" | "telegram">("general");
  const [telegram, setTelegram] = useState({
    enabled: false,
    botToken: "",
    chatId: "",
  });
  const [tgToken, setTgToken] = useState("");
  const [tgChat, setTgChat] = useState("");

  const load = () =>
    Promise.all([
      fetch("/api/options").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([o, s]) => {
      setOptions(o);
      setMasked(s.keys);
      const d: Defaults = s.defaults ?? {};
      setDefaults(d);
      const models = o.models[d.provider ?? ""] ?? { quick: [], deep: [] };
      setQuick(pick(models.quick, d.quick));
      setDeep(pick(models.deep, d.deep));
    });

  const loadTelegram = () =>
    fetch("/api/settings/telegram")
      .then((r) => r.json())
      .then((tg) => {
        setTelegram(tg);
        setTgChat(tg.chatId);
      });

  useEffect(() => {
    load();
    loadTelegram();
  }, []);

  async function saveTelegram(patch: Record<string, unknown>) {
    const res = await fetch("/api/settings/telegram", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) return setMessage(t(body.error ?? "Không lưu được."));
    setTgToken("");
    setMessage(t("Đã lưu."));
    await loadTelegram();
  }

  async function testTelegram() {
    setMessage(t("Đang gửi…"));
    const res = await fetch("/api/settings/telegram", { method: "POST" });
    const body = await res.json();
    setMessage(res.ok ? t("Đã gửi tin nhắn thử.") : body.error);
  }

  if (!options)
    return <main className="p-8 text-slate-400">{t("Đang tải…")}</main>;

  const providerKeys = options.providers
    .filter((p) => p.keyEnv)
    .reduce<{ env: string; labels: string[]; ready: boolean }[]>((acc, p) => {
      const found = acc.find((k) => k.env === p.keyEnv);
      if (found) found.labels.push(p.label);
      else acc.push({ env: p.keyEnv!, labels: [p.label], ready: p.ready });
      return acc;
    }, []);
  const models = options.models[defaults.provider ?? ""] ?? {
    quick: [],
    deep: [],
  };
  const provider = options.providers.find((p) => p.key === defaults.provider);

  async function save(keys: Record<string, string>, nextDefaults?: Defaults) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ keys, defaults: nextDefaults }),
    });
    const body = await res.json();
    if (!res.ok) return setMessage(t(body.error ?? "Không lưu được."));
    setEntered({});
    setMessage(t("Đã lưu."));
    await load();
  }

  const saveDefaults = () =>
    save(
      {},
      {
        ...defaults,
        quick: quick[0] === "custom" ? quick[1].trim() : quick[0],
        deep: deep[0] === "custom" ? deep[1].trim() : deep[0],
      },
    );

  const keyRow = (env: string, label: string, readyElsewhere: boolean) => (
    <div
      key={env}
      className="grid items-center gap-2 border-t border-slate-800 py-3 md:grid-cols-[1fr_1.2fr_auto]"
    >
      <div>
        <div className="font-mono text-sm">{env}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
      <input
        type="password"
        autoComplete="off"
        className="field"
        placeholder={
          masked[env]
            ? `${t("Đã lưu")} ${masked[env]}`
            : readyElsewhere
              ? t("Đang dùng giá trị trong .env")
              : t("Chưa đặt")
        }
        value={entered[env] ?? ""}
        onChange={(e) => setEntered({ ...entered, [env]: e.target.value })}
      />
      <div className="flex gap-2">
        <button
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
          disabled={!entered[env]?.trim()}
          onClick={() => save({ [env]: entered[env] })}
        >
          {t("Lưu")}
        </button>
        {masked[env] && (
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            onClick={() => save({ [env]: "" })}
          >
            {t("Xoá")}
          </button>
        )}
      </div>
    </div>
  );

  const modelPicker = (
    label: string,
    list: ModelList,
    value: [string, string],
    set: (v: [string, string]) => void,
  ) => (
    <div>
      <label className="label">{label}</label>
      <select
        className="field"
        value={value[0]}
        onChange={(e) => set([e.target.value, value[1]])}
      >
        {list.map(([l, v]) => (
          <option key={v} value={v}>
            {v === "custom" ? t("Nhập model ID khác…") : l}
          </option>
        ))}
      </select>
      {value[0] === "custom" && (
        <input
          className="field mt-2"
          placeholder="model ID"
          value={value[1]}
          onChange={(e) => set(["custom", e.target.value])}
        />
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">{t("Cài đặt")}</h1>
        {message && <span className="text-sm text-emerald-300">{message}</span>}
      </header>

      <div className="flex gap-1 border-b border-slate-800">
        {(
          [
            ["general", "Model & API key"],
            ["telegram", "Telegram"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === key
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {tab === "telegram" && (
        <section className="space-y-4 rounded-md border border-slate-800 bg-slate-900/60 p-5">
          <div>
            <h2 className="text-lg font-semibold">{t("Thông báo Telegram")}</h2>
            <p className="text-sm text-slate-400">
              {t(
                "Mỗi khi một mã phân tích xong, gửi quyết định cuối (của Portfolio Manager) vào Telegram. Lần chạy lỗi hoặc bị dừng không gửi.",
              )}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={telegram.enabled}
              onChange={(e) => saveTelegram({ enabled: e.target.checked })}
            />
            {t("Bật thông báo")}
          </label>
          <div>
            <label className="label">Bot token</label>
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="off"
                className="field"
                placeholder={
                  telegram.botToken
                    ? `${t("Đã lưu")} ${telegram.botToken}`
                    : "123456789:AA…"
                }
                value={tgToken}
                onChange={(e) => setTgToken(e.target.value)}
              />
              {telegram.botToken && (
                <button
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                  onClick={() => saveTelegram({ clearToken: true })}
                >
                  {t("Xoá")}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t(
                "Tạo bot với @BotFather trên Telegram, lệnh /newbot, rồi dán token ở đây.",
              )}
            </p>
          </div>
          <div>
            <label className="label">Chat ID</label>
            <input
              className="field"
              placeholder="123456789 / -100…"
              value={tgChat}
              onChange={(e) => setTgChat(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              {t(
                "Nhắn một tin cho bot (hoặc thêm bot vào nhóm), rồi mở https://api.telegram.org/bot<token>/getUpdates để lấy chat.id.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold hover:bg-emerald-500"
              onClick={() =>
                saveTelegram({ botToken: tgToken, chatId: tgChat })
              }
            >
              {t("Lưu")}
            </button>
            <button
              className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
              disabled={!telegram.botToken || !telegram.chatId}
              onClick={testTelegram}
            >
              {t("Gửi tin nhắn thử")}
            </button>
          </div>
        </section>
      )}

      {tab === "general" && (
        <>
          <section className="rounded-md border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold">{t("Model mặc định")}</h2>
            <p className="mb-4 text-sm text-slate-400">
              {t(
                "Phân tích mới sẽ bắt đầu với các lựa chọn này; vẫn đổi được trước khi chạy.",
              )}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">{t("Nhà cung cấp LLM")}</label>
                <select
                  className="field"
                  value={defaults.provider ?? ""}
                  onChange={(e) => {
                    const key = e.target.value;
                    const list = options.models[key] ?? { quick: [], deep: [] };
                    setDefaults({
                      ...defaults,
                      provider: key,
                      backendUrl:
                        options.providers.find((p) => p.key === key)?.url ?? "",
                    });
                    setQuick(pick(list.quick));
                    setDeep(pick(list.deep));
                  }}
                >
                  <option value="">
                    — {t("Không đặt (nhớ lần chạy trước)")} —
                  </option>
                  {options.providers.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                      {p.ready ? "" : ` (${t("chưa có key")})`}
                    </option>
                  ))}
                </select>
              </div>
              {(defaults.provider === "ollama" ||
                defaults.provider === "openai_compatible") && (
                <div>
                  <label className="label">{t("Địa chỉ server")}</label>
                  <input
                    className="field"
                    value={defaults.backendUrl ?? ""}
                    onChange={(e) =>
                      setDefaults({ ...defaults, backendUrl: e.target.value })
                    }
                  />
                </div>
              )}
              {defaults.provider &&
                modelPicker(
                  t("Model nhanh (analyst, trader, tranh luận)"),
                  models.quick,
                  quick,
                  setQuick,
                )}
              {defaults.provider &&
                modelPicker(
                  t("Model sâu (các manager)"),
                  models.deep,
                  deep,
                  setDeep,
                )}
              <div>
                <label className="label">{t("Ngôn ngữ báo cáo")}</label>
                <select
                  className="field"
                  value={defaults.language ?? ""}
                  onChange={(e) =>
                    setDefaults({
                      ...defaults,
                      language: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">— {t("Không đặt")} —</option>
                  {options.languages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("Độ sâu")}</label>
                <select
                  className="field"
                  value={defaults.depth ?? ""}
                  onChange={(e) =>
                    setDefaults({
                      ...defaults,
                      depth: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                >
                  <option value="">— {t("Không đặt")} —</option>
                  {DEPTHS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">{t("Analyst mặc định")}</label>
                <div className="flex flex-wrap gap-4">
                  {options.analysts.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(
                          defaults.analysts ?? options.analysts
                        ).includes(a)}
                        onChange={() => {
                          const current = defaults.analysts ?? options.analysts;
                          setDefaults({
                            ...defaults,
                            analysts: current.includes(a)
                              ? current.filter((x) => x !== a)
                              : [...current, a],
                          });
                        }}
                      />
                      {ANALYST_LABEL[a] ? t(ANALYST_LABEL[a]) : a}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {provider && !provider.ready && (
              <p className="mt-3 text-sm text-amber-300">
                {provider.key === "chatgpt"
                  ? t(
                      "Gói ChatGPT cần đăng nhập: chạy `tradingagents login chatgpt`.",
                    )
                  : t("Chưa có {key}: nhập ở phần API key bên dưới.", {
                      key: provider.keyEnv ?? "",
                    })}
              </p>
            )}
            <button
              className="mt-5 rounded-md bg-emerald-600 px-5 py-2 font-semibold hover:bg-emerald-500"
              onClick={saveDefaults}
            >
              {t("Lưu mặc định")}
            </button>
          </section>

          <section className="rounded-md border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold">API key</h2>
            <p className="mb-2 text-sm text-slate-400">
              {t(
                "Key lưu ở đây được ưu tiên hơn file .env. Trang không bao giờ hiện lại key đã lưu, chỉ 4 ký tự cuối.",
              )}
            </p>
            <h3 className="mt-4 text-sm font-semibold text-slate-300">
              {t("Nhà cung cấp LLM")}
            </h3>
            {providerKeys.map((k) =>
              keyRow(k.env, k.labels.join(", "), k.ready && !masked[k.env]),
            )}
            <h3 className="mt-6 text-sm font-semibold text-slate-300">
              {t("Nguồn dữ liệu")}
            </h3>
            {DATA_KEYS.map(([env, label]) => keyRow(env, t(label), false))}
          </section>
        </>
      )}
    </main>
  );
}
