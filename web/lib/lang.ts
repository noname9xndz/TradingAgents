/** The page languages. The source text is Vietnamese; other languages translate it. */
export type Lang = "vi" | "en";

export const LANGS: { key: Lang; label: string; locale: string }[] = [
  { key: "vi", label: "Tiếng Việt", locale: "vi-VN" },
  { key: "en", label: "English", locale: "en-US" },
];

export const LANG_COOKIE = "lang";

export const toLang = (value: string | undefined): Lang => (LANGS.some((l) => l.key === value) ? (value as Lang) : "vi");
