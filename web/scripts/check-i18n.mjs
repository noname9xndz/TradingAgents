// Every text the pages translate with t("...") must have an English entry in lib/en.ts,
// and so must the labels kept as data (agents, steps, categories…) that reach t() through a variable.
// Run: node scripts/check-i18n.mjs
import { readFileSync } from "node:fs";

const files = ["app/page.tsx", "components/Workspace.tsx", "app/settings/page.tsx", "components/Header.tsx", "app/queue/page.tsx", "app/jobs/page.tsx"];
const keys = new Set();
for (const file of files) {
  const source = readFileSync(file, "utf-8");
  for (const [, key] of source.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) keys.add(key);
}

// Labels translated through a variable: the Vietnamese strings in these data tables.
const DATA_FILES = { "components/Workspace.tsx": /^(const (SPEAKERS|SECTION_PHASE|ANALYSTS|SECTION_LABELS|DEPTHS|PLACEHOLDER)\b|function stages)/ };
for (const [file] of Object.entries(DATA_FILES)) {
  const source = readFileSync(file, "utf-8");
  for (const block of source.split(/\n(?=const |function )/)) {
    if (!DATA_FILES[file].test(block)) continue;
    for (const [, text] of block.matchAll(/"([^"]*[À-ỹĐđ][^"]*)"/g)) keys.add(text);
  }
}
for (const file of ["lib/shared.ts", "app/page.tsx", "app/settings/page.tsx", "components/Header.tsx", "app/queue/page.tsx", "app/jobs/page.tsx"]) {
  const source = readFileSync(file, "utf-8");
  for (const block of source.split(/\n(?=const |export const )/)) {
    if (!/^(export )?const (CATEGORIES|STATUS_LABEL|ANALYST_LABEL|DATA_KEYS|DEPTHS|NAV|DAYS)\b/.test(block)) continue;
    for (const [, text] of block.matchAll(/"([^"]*[À-ỹĐđ][^"]*)"/g)) keys.add(text);
  }
}
for (const name of ["Analyst Thị trường", "Analyst Tâm lý", "Analyst Tin tức", "Analyst Cơ bản"]) keys.add(name);

const en = readFileSync("lib/en.ts", "utf-8");
const missing = [...keys].filter((key) => !en.includes(JSON.stringify(key)));
if (missing.length) {
  console.error(`Missing English for ${missing.length} text(s):\n` + missing.map((k) => `  ${JSON.stringify(k)}`).join("\n"));
  process.exit(1);
}
console.log(`All ${keys.size} texts have an English entry.`);
