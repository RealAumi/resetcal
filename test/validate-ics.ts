import { fetchFeed, isBanked, isConfirmed, isForecast, isTentative, selectEvents } from "../src/feed";
import { buildCalendar, foldLine, nextSequence } from "../src/ics";
import type { Feed, FeedEvent } from "../src/types";
import ICAL from "ical.js";

const now = new Date("2026-09-14T07:00:00.000Z");

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function structuralCheck(ics: string, calName: string): void {
  assert(ics.startsWith("BEGIN:VCALENDAR"), "must start with BEGIN:VCALENDAR");
  assert(ics.trimEnd().endsWith("END:VCALENDAR"), "must end with END:VCALENDAR");
  assert(ics.includes("METHOD:PUBLISH"), "missing METHOD:PUBLISH");
  assert(ics.includes(`X-WR-CALNAME:${calName}`), `missing ${calName}`);
  assert(ics.includes("\r\n"), "ICS must use CRLF");
  for (const raw of ics.split("\r\n")) {
    if (!raw) continue;
    const line = raw.startsWith(" ") ? raw : raw;
    const bytes = Buffer.byteLength(line, "utf8");
    assert(bytes <= 75, `unfolded line too long (${bytes}): ${line.slice(0, 80)}`);
  }
}

function parseCalendar(ics: string) {
  const jcal = ICAL.parse(ics);
  const comp = new ICAL.Component(jcal);
  assert(comp.name === "vcalendar", "ICAL parse did not yield VCALENDAR");
  return comp;
}

function fixtureEvents(): FeedEvent[] {
  return [
    {
      id: "confirmed-window",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "hard",
      summary: "Future confirmed reset with a long summary that should fold when it exceeds seventy-five octets in a DESCRIPTION line, plus commas, and a newline.",
      url: "https://x.com/thsottiaux/status/confirmed-window",
      announced_at: "2026-09-20T18:00:00.000Z",
      official_window: {
        start_at: "2026-09-20T18:00:00.000Z",
        end_at: "2026-09-20T19:00:00.000Z",
      },
    },
    {
      id: "confirmed-recent-hard",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "hard",
      summary: "Recent hard reset",
      url: "https://x.com/thsottiaux/status/confirmed-recent-hard",
      announced_at: "2026-09-10T02:00:00.000Z",
    },
    {
      id: "confirmed-missing-kind",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      summary: "Archive high-conf with missing reset_kind counts as hard",
      announced_at: "2026-09-12T12:00:00.000Z",
    },
    {
      id: "old-hard",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "hard",
      summary: "Too old for the 14-day window",
      announced_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "tentative-preview",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: true,
      summary: "Preview window",
      url: "https://x.com/thsottiaux/status/tentative-preview",
      announced_at: "2026-09-18T01:00:00.000Z",
      official_window: {
        start_at: "2026-09-18T01:00:00.000Z",
        end_at: "2026-09-18T02:00:00.000Z",
      },
    },
    {
      id: "banked",
      type: "credits",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "banked",
      summary: "Banked reset must not appear",
      announced_at: "2026-09-13T00:00:00.000Z",
    },
    {
      id: "forecast-pct",
      type: "forecast-24h",
      source: "archive",
      confidence: "high",
      preview: false,
      summary: "Forecast must not appear",
      announced_at: "2026-09-14T08:00:00.000Z",
    },
    {
      id: "live-medium",
      type: "reset",
      source: "live",
      confidence: "medium",
      preview: false,
      announcement_state: "announced",
      summary: "Live medium is not confirmed",
      announced_at: "2026-09-12T08:09:17.000Z",
    },
  ];
}

function testFilters(): void {
  const feed: Feed = { events: fixtureEvents() };
  const confirmed = selectEvents(feed, "confirmed", now).map((e) => e.id);
  const tentative = selectEvents(feed, "tentative", now).map((e) => e.id);
  assert(confirmed.includes("confirmed-window"), "future window should be confirmed");
  assert(confirmed.includes("confirmed-recent-hard"), "recent hard should be confirmed");
  assert(confirmed.includes("confirmed-missing-kind"), "missing reset_kind archive high-conf should be confirmed");
  assert(!confirmed.includes("old-hard"), "old hard should drop off");
  assert(!confirmed.includes("tentative-preview"), "preview must not be confirmed");
  assert(!confirmed.includes("banked"), "banked must not be confirmed");
  assert(!confirmed.includes("forecast-pct"), "forecast must not be confirmed");
  assert(!confirmed.includes("live-medium"), "live medium must not be confirmed");
  assert(tentative.includes("tentative-preview"), "preview should be tentative");
  assert(!tentative.includes("banked"), "banked must not be tentative");
  assert(!tentative.includes("forecast-pct"), "forecast must not be tentative");
  assert(!tentative.includes("confirmed-window"), "confirmed event must not also be tentative");
  const banked = fixtureEvents().find((e) => e.id === "banked")!;
  const forecast = fixtureEvents().find((e) => e.id === "forecast-pct")!;
  assert(isBanked(banked) && isForecast(forecast), "banked/forecast helpers");
  assert(!isConfirmed(banked, now) && !isTentative(banked, now), "banked excluded from both");
  assert(!isConfirmed(forecast, now) && !isTentative(forecast, now), "forecast excluded from both");
}

function testSequence(): void {
  const first = nextSequence(null, "a|b");
  assert(first.sequence === 0, "new window starts at SEQUENCE 0");
  const same = nextSequence(first, "a|b");
  assert(same.sequence === 0, "unchanged window keeps SEQUENCE");
  const moved = nextSequence(first, "c|d");
  assert(moved.sequence === 1, "moved window increments SEQUENCE");
}

function testIcsParse(): void {
  const feed: Feed = { events: fixtureEvents() };
  const confirmedEvents = selectEvents(feed, "confirmed", now);
  const tentativeEvents = selectEvents(feed, "tentative", now);
  const confirmed = buildCalendar(confirmedEvents, "confirmed", new Map(confirmedEvents.map((e) => [e.id, 0])));
  const tentative = buildCalendar(tentativeEvents, "tentative", new Map(tentativeEvents.map((e) => [e.id, 2])));

  structuralCheck(confirmed, "Codex resets (confirmed)");
  structuralCheck(tentative, "Codex resets (tentative)");

  const confirmedComp = parseCalendar(confirmed);
  const tentativeComp = parseCalendar(tentative);
  const confirmedEventsParsed = confirmedComp.getAllSubcomponents("vevent");
  const tentativeEventsParsed = tentativeComp.getAllSubcomponents("vevent");
  assert(confirmedEventsParsed.length === 3, `expected 3 confirmed VEVENTs, got ${confirmedEventsParsed.length}`);
  assert(tentativeEventsParsed.length === 1, `expected 1 tentative VEVENT, got ${tentativeEventsParsed.length}`);

  const first = confirmedEventsParsed[0]!;
  assert(first.getFirstPropertyValue("uid") === "confirmed-window", "UID is source event id");
  assert(String(first.getFirstPropertyValue("status")).toUpperCase() === "CONFIRMED", "STATUS CONFIRMED");
  assert(first.getFirstPropertyValue("url"), "URL present");
  assert(first.getFirstProperty("dtstart"), "DTSTART present");
  assert(first.getFirstProperty("dtend"), "DTEND present");
  assert(first.getFirstProperty("sequence") !== null, "SEQUENCE present");

  const preview = tentativeEventsParsed[0]!;
  assert(preview.getFirstPropertyValue("uid") === "tentative-preview", "tentative UID");
  assert(String(preview.getFirstPropertyValue("status")).toUpperCase() === "TENTATIVE", "STATUS TENTATIVE");

  const long = foldLine(
    "DESCRIPTION:Future confirmed reset with a long summary that should fold when it exceeds seventy-five octets in a DESCRIPTION line, plus commas, and a newline.",
  );
  assert(long.includes("\r\n "), "long DESCRIPTION must fold with CRLF + space");

  const empty = buildCalendar([], "confirmed", new Map());
  structuralCheck(empty, "Codex resets (confirmed)");
  parseCalendar(empty);
}

async function testLiveFeed(): Promise<void> {
  const feed = await fetchFeed();
  const confirmed = selectEvents(feed, "confirmed", now);
  const tentative = selectEvents(feed, "tentative", now);
  const ics = buildCalendar(confirmed, "confirmed", new Map(confirmed.map((e) => [e.id, 0])));
  structuralCheck(ics, "Codex resets (confirmed)");
  const parsed = parseCalendar(ics);
  const vevents = parsed.getAllSubcomponents("vevent");
  assert(vevents.length === confirmed.length, "live confirmed VEVENT count");
  for (const event of confirmed) {
    assert(event.source === "archive", "live confirmed source");
    assert(event.type === "reset", "live confirmed type");
    assert(event.confidence === "high", "live confirmed confidence");
    assert(event.preview === false, "live confirmed preview");
    assert(!isBanked(event) && !isForecast(event), "live confirmed not banked/forecast");
  }
  for (const event of tentative) {
    assert(event.type === "reset", "live tentative type");
    assert(!isBanked(event) && !isForecast(event), "live tentative not banked/forecast");
  }
  const tentativeIcs = buildCalendar(tentative, "tentative", new Map());
  structuralCheck(tentativeIcs, "Codex resets (tentative)");
  parseCalendar(tentativeIcs);
  console.log(
    `live feed: ${feed.events?.length ?? 0} events → ${confirmed.length} confirmed, ${tentative.length} tentative VEVENTs`,
  );
  if (confirmed[0]) {
    console.log("sample confirmed UID", confirmed[0].id);
  }
}

async function main(): Promise<void> {
  testFilters();
  testSequence();
  testIcsParse();
  await testLiveFeed();
  console.log("ICS validity: ical.js parse + structural checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
