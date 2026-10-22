// Run: node scripts/check-error-kinds.ts (Node 22.18+ runs TypeScript directly).
import assert from "node:assert/strict";
import { errorKind } from "../lib/error-kinds.ts";

const cases: [string, string][] = [
  ["OpenAIModelNotFoundError: Error code: 404 - The `:free` variant has been retired", "model"],
  ["Error code: 400 - khong-ton-tai/model-x is not a valid model ID", "model"],
  ["inception/mercury-decide:free is a decisions model and cannot be used with the chat/completions endpoint", "model"],
  ["Error code: 401 - Unauthorized", "auth"],
  ["Telegram: Unauthorized", "auth"],
  ["Error code: 402 - Insufficient credits", "quota"],
  ["Error code: 429 - Rate limit exceeded", "rate"],
  ["connect ECONNREFUSED 127.0.0.1:11434", "network"],
  ["Tiến trình phân tích đã dừng.", "process"],
  ["Something odd", "other"],
];
for (const [message, kind] of cases) assert.equal(errorKind(message), kind, message);
console.log(`All ${cases.length} error kinds classified.`);
