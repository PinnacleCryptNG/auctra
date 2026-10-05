import { describe, expect, it } from "vitest";
import { describeSchedule, isValidTimezone, nextOccurrence } from "../lib/schedule";

const iso = (date: Date | null) => date?.toISOString() ?? null;
const at = (value: string) => new Date(value);

describe("nextOccurrence", () => {
  it("finds the next Friday 18:00 in the user's timezone", () => {
    // 2026-10-05 is a Monday. Lagos is UTC+1 with no DST.
    const next = nextOccurrence({ frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" }, "Africa/Lagos", at("2026-10-05T10:00:00Z"));
    expect(iso(next)).toBe("2026-10-09T17:00:00.000Z");
  });

  it("is strictly after the reference instant", () => {
    const schedule = { frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" } as const;
    const next = nextOccurrence(schedule, "Africa/Lagos", at("2026-10-09T17:00:00Z"));
    expect(iso(next)).toBe("2026-10-16T17:00:00.000Z");
  });

  it("runs daily, rolling to tomorrow once today's time has passed", () => {
    const schedule = { frequency: "DAILY", time: "09:30" } as const;
    expect(iso(nextOccurrence(schedule, "UTC", at("2026-10-05T09:00:00Z")))).toBe("2026-10-05T09:30:00.000Z");
    expect(iso(nextOccurrence(schedule, "UTC", at("2026-10-05T09:30:00Z")))).toBe("2026-10-06T09:30:00.000Z");
  });

  it("clamps dayOfMonth 31 to the last day of shorter months", () => {
    const schedule = { frequency: "MONTHLY", dayOfMonth: 31, time: "12:00" } as const;
    expect(iso(nextOccurrence(schedule, "UTC", at("2026-02-01T00:00:00Z")))).toBe("2026-02-28T12:00:00.000Z");
    expect(iso(nextOccurrence(schedule, "UTC", at("2026-02-28T12:00:00Z")))).toBe("2026-03-31T12:00:00.000Z");
    expect(iso(nextOccurrence(schedule, "UTC", at("2028-02-01T00:00:00Z")))).toBe("2028-02-29T12:00:00.000Z");
  });

  it("returns a once-only occurrence, then null", () => {
    const schedule = { frequency: "ONCE", date: "2026-12-24", time: "08:00" } as const;
    expect(iso(nextOccurrence(schedule, "Europe/London", at("2026-10-05T00:00:00Z")))).toBe("2026-12-24T08:00:00.000Z");
    expect(nextOccurrence(schedule, "Europe/London", at("2026-12-24T08:00:00Z"))).toBeNull();
  });

  it("runs a time inside a DST gap at the first minute after the gap", () => {
    // New York springs forward 2026-03-08: 02:00 EST → 03:00 EDT (07:00Z).
    const schedule = { frequency: "DAILY", time: "02:30" } as const;
    expect(iso(nextOccurrence(schedule, "America/New_York", at("2026-03-08T00:00:00Z")))).toBe("2026-03-08T07:00:00.000Z");
  });

  it("runs a repeated DST-overlap time once, at its first occurrence", () => {
    // New York falls back 2026-11-01: 01:30 happens at 05:30Z (EDT) and 06:30Z (EST).
    const schedule = { frequency: "DAILY", time: "01:30" } as const;
    const first = nextOccurrence(schedule, "America/New_York", at("2026-11-01T04:00:00Z"));
    expect(iso(first)).toBe("2026-11-01T05:30:00.000Z");
    expect(iso(nextOccurrence(schedule, "America/New_York", first!))).toBe("2026-11-02T06:30:00.000Z");
  });

  it("rejects invalid timezones", () => {
    expect(isValidTimezone("Mars/Base")).toBe(false);
    expect(() => nextOccurrence({ frequency: "DAILY", time: "09:00" }, "Mars/Base", new Date())).toThrow();
  });
});

describe("describeSchedule", () => {
  it("always includes the timezone", () => {
    expect(describeSchedule({ frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" }, "Africa/Lagos")).toBe(
      "every Friday at 18:00 (Africa/Lagos)"
    );
    expect(describeSchedule({ frequency: "MONTHLY", dayOfMonth: 1, time: "09:00" }, "UTC")).toBe(
      "on the 1st of every month at 09:00 (UTC)"
    );
  });
});
