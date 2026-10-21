/** When a scheduled job runs, in the server's local time. Pure, so scripts/check-schedule.ts can test it. */
export type Schedule =
  | { type: "once"; at: string } // "YYYY-MM-DDTHH:MM"
  | { type: "daily"; time: string } // "HH:MM"
  | { type: "weekly"; time: string; days: number[] } // 0 = Sunday … 6 = Saturday
  | { type: "interval"; everyHours: number };

const hm = (time: string) => time.split(":").map(Number) as [number, number];

/** The first run strictly after ``after``, or null when the schedule has no more runs.
 * ``last`` is the previous run of an interval schedule, which counts from it. */
export function nextRun(schedule: Schedule, after: Date, last?: Date): Date | null {
  if (schedule.type === "once") {
    const at = new Date(schedule.at);
    return at > after ? at : null;
  }
  if (schedule.type === "interval") {
    const hours = Math.max(schedule.everyHours, 0.25);
    const base = last ?? after;
    const next = new Date(base.getTime() + hours * 3_600_000);
    return next > after ? next : new Date(after.getTime() + hours * 3_600_000);
  }
  const [h, m] = hm(schedule.time);
  const days = schedule.type === "weekly" ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
  if (!days.length) return null;
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + offset, h, m, 0, 0);
    if (day > after && days.includes(day.getDay())) return day;
  }
  return null;
}

/** The analysis date for a run started at ``at``: that day, in local time. */
export const tradeDate = (at: Date) => at.toLocaleDateString("sv-SE");
