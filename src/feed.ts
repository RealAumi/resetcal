import type { Feed, FeedEvent, WindowTimes } from "./types";

export const FEED_URL = "https://codex-reset.com/api/feed";
export const FALLBACK_WINDOW_MS = 30 * 60 * 1000;
export const RECENT_HARD_DAYS = 14;
const MS_PER_UTC_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ANNOUNCED_SOURCES = new Set(["live", "operator-observed"]);

const SCHEDULED_STATES = new Set(["scheduled", "preview", "pending"]);

function lower(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isForecast(event: FeedEvent): boolean {
  const type = lower(event.type);
  const group = lower(event.group);
  return (
    type.startsWith("forecast") ||
    group.startsWith("forecast") ||
    type.includes("forecast-%") ||
    group.includes("forecast-%")
  );
}

export function isBanked(event: FeedEvent): boolean {
  return lower(event.reset_kind) === "banked" || lower(event.type) === "credits";
}

export function isResetType(event: FeedEvent): boolean {
  return lower(event.type) === "reset";
}

export function isConfirmedBase(event: FeedEvent): boolean {
  return (
    lower(event.source) === "archive" &&
    isResetType(event) &&
    lower(event.confidence) === "high" &&
    event.preview === false &&
    !isBanked(event) &&
    !isForecast(event)
  );
}

export function isAnnouncedObservedReset(event: FeedEvent): boolean {
  return (
    isResetType(event) &&
    event.preview === false &&
    !isBanked(event) &&
    !isForecast(event) &&
    ANNOUNCED_SOURCES.has(lower(event.source)) &&
    lower(event.announcement_state) === "announced"
  );
}

export function isConfirmedCandidate(event: FeedEvent): boolean {
  return isConfirmedBase(event) || isAnnouncedObservedReset(event);
}

export function isHardForFourteenDayWindow(event: FeedEvent): boolean {
  if (lower(event.reset_kind) === "hard") return true;
  return !event.reset_kind && isConfirmedCandidate(event);
}

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseUtcDateOnly(value: string): Date | null {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function eventCalendarDate(event: FeedEvent, win: WindowTimes | null): Date | null {
  if (event.date) {
    const fromDate = parseUtcDateOnly(event.date);
    if (fromDate) return fromDate;
  }
  if (event.announced_at) {
    const announced = new Date(event.announced_at);
    if (!Number.isNaN(announced.getTime())) {
      return new Date(utcMidnight(announced));
    }
  }
  if (win) {
    return new Date(utcMidnight(win.start));
  }
  return null;
}

export function inclusiveUtcDayDelta(now: Date, eventDay: Date): number {
  return Math.round((utcMidnight(now) - utcMidnight(eventDay)) / MS_PER_UTC_DAY);
}

export function isWithinInclusiveUtcDays(eventDay: Date, now: Date, days: number): boolean {
  return inclusiveUtcDayDelta(now, eventDay) <= days;
}

export function eventWindow(event: FeedEvent): WindowTimes | null {
  const window = event.official_window;
  if (window?.start_at) {
    const start = new Date(window.start_at);
    if (Number.isNaN(start.getTime())) return null;
    const end = window.end_at ? new Date(window.end_at) : new Date(start.getTime() + FALLBACK_WINDOW_MS);
    if (Number.isNaN(end.getTime())) {
      return { start, end: new Date(start.getTime() + FALLBACK_WINDOW_MS) };
    }
    if (end.getTime() < start.getTime()) {
      return { start, end: new Date(start.getTime() + FALLBACK_WINDOW_MS) };
    }
    return { start, end };
  }

  if (event.announced_at) {
    const start = new Date(event.announced_at);
    if (Number.isNaN(start.getTime())) return null;
    return { start, end: new Date(start.getTime() + FALLBACK_WINDOW_MS) };
  }

  return null;
}

export function windowHash(win: WindowTimes): string {
  return `${win.start.toISOString()}|${win.end.toISOString()}`;
}

export function isFutureOrInFlight(win: WindowTimes, now: Date): boolean {
  return win.end.getTime() >= now.getTime();
}

export function isRecentHard(event: FeedEvent, win: WindowTimes, now: Date): boolean {
  if (!isHardForFourteenDayWindow(event)) return false;
  const day = eventCalendarDate(event, win);
  if (!day) return false;
  return isWithinInclusiveUtcDays(day, now, RECENT_HARD_DAYS);
}

export function isConfirmed(event: FeedEvent, now: Date): boolean {
  if (!isConfirmedCandidate(event)) return false;
  const win = eventWindow(event);
  if (!win) return false;
  return isFutureOrInFlight(win, now) || isRecentHard(event, win, now);
}

export function isScheduledOrPreview(event: FeedEvent): boolean {
  if (event.preview === true) return true;
  if (lower(event.time_kind).includes("preview")) return true;
  if (SCHEDULED_STATES.has(lower(event.announcement_state))) return true;
  return false;
}

export function isTentative(event: FeedEvent, now: Date): boolean {
  if (!isResetType(event) || isBanked(event) || isForecast(event)) return false;
  if (isConfirmed(event, now)) return false;
  if (!isScheduledOrPreview(event)) return false;
  const win = eventWindow(event);
  if (!win) return false;
  if (isFutureOrInFlight(win, now)) return true;
  const day = eventCalendarDate(event, win);
  if (!day) return false;
  return isWithinInclusiveUtcDays(day, now, RECENT_HARD_DAYS);
}

export function dedupeEvents(events: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  const out: FeedEvent[] = [];
  for (const event of events) {
    if (!event?.id) continue;
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

export function selectEvents(feed: Feed, kind: "confirmed" | "tentative", now = new Date()): FeedEvent[] {
  const events = dedupeEvents(feed.events ?? []);
  return events.filter((event) => (kind === "confirmed" ? isConfirmed(event, now) : isTentative(event, now)));
}

export async function fetchFeed(fetcher: typeof fetch = fetch): Promise<Feed> {
  const response = await fetcher(FEED_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "resetcal/1.0 (unofficial Codex reset calendar)",
    },
  });
  if (!response.ok) {
    throw new Error(`feed ${response.status}`);
  }
  const data = (await response.json()) as Feed;
  if (!data || !Array.isArray(data.events)) {
    throw new Error("feed missing events[]");
  }
  return data;
}
