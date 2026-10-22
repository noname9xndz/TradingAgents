import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { keyEnv } from "./settings";

// The repository root: the web app lives one folder below it.
const ROOT = path.resolve(process.cwd(), "..");
const VENV_PYTHON = path.join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const PYTHON = process.env.PYTHON || (existsSync(VENV_PYTHON) ? VENV_PYTHON : "python");

/** Start `python -m cli.web_bridge <command>`; it writes one JSON object per line. */
export function bridge(command: "options" | "run" | "ping") {
  const child = spawn(PYTHON, ["-m", "cli.web_bridge", command], {
    cwd: ROOT,
    // Keys saved on the settings page reach Python as environment variables;
    // python-dotenv does not override them with .env.
    env: { ...process.env, ...keyEnv(), PYTHONIOENCODING: "utf-8" },
  });
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

export const errorLine = (message: string) => JSON.stringify({ type: "error", message }) + "\n";
