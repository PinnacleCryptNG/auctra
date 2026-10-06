import { DateTime, IANAZone } from "luxon";
import { DAYS_OF_WEEK, type AutomationSchedule } from "./automation-types";

// PRD §9 schedule rules. Occurrences are wall-clock times in the automation's
// IANA timezone, returned as UTC instants.
//  - A wall time that doesn't exist (DST gap) runs at the first valid minute after it.
//  - A repeated wall time (DST overlap) runs once, at its first occurrence.
//  - dayOfMonth 29–31 runs on the last day of shorter months.

export function isValidTimezone(timezone: string): boolean {
  return IANAZone.isValidZone(timezone);
}

function assertTimezone(timezone: string) {
  if (!isValidTimezone(timezone)) throw new Error(`Invalid timezone: ${timezone}`);
}

function parseTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

/** Wall-clock time on a local date → UTC instant, applying the DST rules above. */
function localInstant(date: DateTime, time: string, timezone: string): Date {
  const { hour, minute } = parseTime(time);
  const wanted = { year: date.year, month: date.month, day: date.day, hour, minute };
  const candidate = DateTime.fromObject(wanted, { zone: timezone });

  // DST gap: Luxon shifts a nonexistent time forward by the gap length. Walk
  // back to the first minute after the gap (the moment the clocks jumped).
  if (candidate.hour !== hour || candidate.minute !== minute) {
    let instant = candidate;
    while (instant.minus({ minutes: 1 }).offset === instant.offset) instant = instant.minus({ minutes: 1 });
    return instant.toJSDate();
  }

  // DST overlap: pick the earliest instant with this wall time.
  const earlier = candidate.minus({ hours: 1 });
  if (earlier.hour === hour && earlier.minute === minute && earlier.day === candidate.day) {
    return earlier.toJSDate();
  }

  return candidate.toJSDate();
}

/** First occurrence strictly after `after`, or null if the schedule has no more. */
export function nextOccurrence(schedule: AutomationSchedule, timezone: string, after: Date): Date | null {
  assertTimezone(timezone);
  const start = DateTime.fromJSDate(after, { zone: timezone }).startOf("day");
  const isAfter = (instant: Date) => instant.getTime() > after.getTime();

  switch (schedule.frequency) {
    case "ONCE": {
      const date = DateTime.fromISO(schedule.date, { zone: timezone });
      if (!date.isValid) throw new Error(`Invalid date: ${schedule.date}`);
      const instant = localInstant(date, schedule.time, timezone);
      return isAfter(instant) ? instant : null;
    }

    case "DAILY": {
      for (let offset = 0; offset <= 2; offset++) {
        const instant = localInstant(start.plus({ days: offset }), schedule.time, timezone);
        if (isAfter(instant)) return instant;
      }
      break;
    }

    case "WEEKLY": {
      const weekday = DAYS_OF_WEEK.indexOf(schedule.dayOfWeek) + 1; // Luxon: Monday = 1
      for (let offset = 0; offset <= 14; offset++) {
        const day = start.plus({ days: offset });
        if (day.weekday !== weekday) continue;
        const instant = localInstant(day, schedule.time, timezone);
        if (isAfter(instant)) return instant;
      }
      break;
    }

    case "MONTHLY": {
      for (let offset = 0; offset <= 13; offset++) {
        const month = start.startOf("month").plus({ months: offset });
        const day = month.set({ day: Math.min(schedule.dayOfMonth, month.daysInMonth ?? 28) });
        const instant = localInstant(day, schedule.time, timezone);
        if (isAfter(instant)) return instant;
      }
      break;
    }
  }

  throw new Error("Could not compute the next occurrence.");
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Human-readable schedule for confirmations (PRD §13: always show the timezone). */
export function describeSchedule(schedule: AutomationSchedule, timezone: string): string {
  const at = `at ${schedule.time} (${timezone})`;
  switch (schedule.frequency) {
    case "ONCE":
      return `once on ${schedule.date} ${at}`;
    case "DAILY":
      return `every day ${at}`;
    case "WEEKLY":
      return `every ${WEEKDAY_NAMES[DAYS_OF_WEEK.indexOf(schedule.dayOfWeek)]} ${at}`;
    case "MONTHLY":
      return `on the ${ordinal(schedule.dayOfMonth)} of every month ${at}${
        schedule.dayOfMonth > 28 ? " (last day in shorter months)" : ""
      }`;
  }
}
