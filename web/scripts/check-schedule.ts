// Run: node scripts/check-schedule.ts (Node 22.18+ runs TypeScript directly).
import assert from "node:assert/strict";
import { nextRun } from "../lib/schedule.ts";

const at = (s: string) => new Date(s); // local time

// Daily: later today, else tomorrow.
assert.deepEqual(nextRun({ type: "daily", time: "09:30" }, at("2026-10-22T08:00")), at("2026-10-22T09:30"));
assert.deepEqual(nextRun({ type: "daily", time: "09:30" }, at("2026-10-22T09:30")), at("2026-10-23T09:30"));

// Weekly on Monday (1) and Friday (5); 2026-10-22 is a Thursday.
assert.deepEqual(nextRun({ type: "weekly", time: "07:00", days: [1, 5] }, at("2026-10-22T12:00")), at("2026-10-23T07:00"));
assert.deepEqual(nextRun({ type: "weekly", time: "07:00", days: [1, 5] }, at("2026-10-23T07:00")), at("2026-10-26T07:00"));
assert.equal(nextRun({ type: "weekly", time: "07:00", days: [] }, at("2026-10-22T12:00")), null);

// Once: only while still ahead.
assert.deepEqual(nextRun({ type: "once", at: "2026-10-25T10:00" }, at("2026-10-22T12:00")), at("2026-10-25T10:00"));
assert.equal(nextRun({ type: "once", at: "2026-10-20T10:00" }, at("2026-10-22T12:00")), null);

// Interval: from the last run, or from now when that is already past.
assert.deepEqual(nextRun({ type: "interval", everyHours: 6 }, at("2026-10-22T12:00"), at("2026-10-22T10:00")), at("2026-10-22T16:00"));
assert.deepEqual(nextRun({ type: "interval", everyHours: 6 }, at("2026-10-22T12:00"), at("2026-10-21T00:00")), at("2026-10-22T18:00"));

console.log("schedule checks passed");
