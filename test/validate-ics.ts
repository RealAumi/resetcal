import { fetchFeed, isBanked, isBoost, isConfirmed, isForecast, isTentative, selectEvents } from "../src/feed";
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
      id: "archive-hard-boundary",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "hard",
      announcement_state: "announced",
      summary: "Aug 31-style archive hard near the rolling-ms boundary",
      date: "2026-08-31",
      announced_at: "2026-08-31T02:34:27.000Z",
    },
    {
      id: "archive-hard-day-15",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "hard",
      summary: "One UTC day past the inclusive 14-day window",
      date: "2026-08-30",
      announced_at: "2026-08-30T12:00:00.000Z",
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
      summary: "Reset all propagated. Sweet dreams.",
      date: "2026-09-12",
      announced_at: "2026-09-12T08:09:17.000Z",
    },
    {
      id: "live-reset-state-none",
      type: "reset",
      source: "live",
      confidence: "medium",
      preview: false,
      announcement_state: "none",
      summary: "Live reset with announcement_state none must not be confirmed",
      date: "2026-09-12",
      announced_at: "2026-09-12T03:20:36.000Z",
    },
    {
      id: "live-reset-state-missing",
      type: "reset",
      source: "live",
      confidence: "medium",
      preview: false,
      summary: "Live reset with missing announcement_state must not be confirmed",
      date: "2026-09-12",
      announced_at: "2026-09-12T04:00:00.000Z",
    },
    {
      id: "operator-observed-announced",
      type: "reset",
      source: "operator-observed",
      confidence: "medium",
      preview: false,
      announcement_state: "announced",
      summary: "Operator-observed announced reset is a confirmed candidate",
      date: "2026-09-08",
      announced_at: "2026-09-08T04:00:00.000Z",
    },
    {
      id: "scheduled-archive",
      type: "reset",
      source: "archive",
      confidence: "high",
      preview: false,
      reset_kind: "hard",
      announcement_state: "scheduled",
      summary: "Scheduled reset is tentative only",
      announced_at: "2026-09-21T18:00:00.000Z",
      official_window: {
        start_at: "2026-09-21T18:00:00.000Z",
        end_at: "2026-09-21T19:00:00.000Z",
      },
    },
    {
      id: "boost-live",
      type: "boost",
      group: "boost",
      source: "live",
      confidence: "medium",
      preview: false,
      announcement_state: "announced",
      summary: "Boost must not appear",
      date: "2026-09-12",
      announced_at: "2026-09-12T06:00:00.000Z",
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
  assert(confirmed.includes("archive-hard-boundary"), "Aug 31-style archive hard on day 14 should be confirmed");
  assert(confirmed.includes("live-medium"), "Sep 12-style live/medium/announced should be confirmed");
  assert(confirmed.includes("operator-observed-announced"), "operator-observed announced should be confirmed");
  assert(!confirmed.includes("archive-hard-day-15"), "day 15 archive hard should drop off");
  assert(!confirmed.includes("old-hard"), "old hard should drop off");
  assert(!confirmed.includes("tentative-preview"), "preview must not be confirmed");
  assert(!confirmed.includes("scheduled-archive"), "scheduled must not be confirmed");
  assert(!confirmed.includes("banked"), "banked must not be confirmed");
  assert(!confirmed.includes("forecast-pct"), "forecast must not be confirmed");
  assert(!confirmed.includes("boost-live"), "boost must not be confirmed");
  assert(!confirmed.includes("live-reset-state-none"), "live reset with announcement_state none must not be confirmed");
  assert(!confirmed.includes("live-reset-state-missing"), "live reset with missing announcement_state must not be confirmed");
  assert(tentative.includes("tentative-preview"), "preview should be tentative");
  assert(tentative.includes("scheduled-archive"), "scheduled should be tentative");
  assert(!tentative.includes("banked"), "banked must not be tentative");
  assert(!tentative.includes("forecast-pct"), "forecast must not be tentative");
  assert(!tentative.includes("boost-live"), "boost must not be tentative");
  assert(!tentative.includes("confirmed-window"), "confirmed event must not also be tentative");
  assert(!tentative.includes("live-medium"), "announced live reset must not also be tentative");
  const banked = fixtureEvents().find((e) => e.id === "banked")!;
  const forecast = fixtureEvents().find((e) => e.id === "forecast-pct")!;
  const boost = fixtureEvents().find((e) => e.id === "boost-live")!;
  assert(isBanked(banked) && isForecast(forecast) && isBoost(boost), "banked/forecast/boost helpers");
  assert(!isConfirmed(banked, now) && !isTentative(banked, now), "banked excluded from both");
  assert(!isConfirmed(forecast, now) && !isTentative(forecast, now), "forecast excluded from both");
  assert(!isConfirmed(boost, now) && !isTentative(boost, now), "boost excluded from both");
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
  assert(confirmedEventsParsed.length === 6, `expected 6 confirmed VEVENTs, got ${confirmedEventsParsed.length}`);
  assert(tentativeEventsParsed.length === 2, `expected 2 tentative VEVENTs, got ${tentativeEventsParsed.length}`);

  const first = confirmedEventsParsed[0]!;
  assert(first.getFirstPropertyValue("uid") === "confirmed-window", "UID is source event id");
  assert(String(first.getFirstPropertyValue("status")).toUpperCase() === "CONFIRMED", "STATUS CONFIRMED");
  assert(first.getFirstPropertyValue("url"), "URL present");
  assert(first.getFirstProperty("dtstart"), "DTSTART present");
  assert(first.getFirstProperty("dtend"), "DTEND present");
  assert(first.getFirstProperty("sequence") !== null, "SEQUENCE present");

  const preview = tentativeEventsParsed.find((event) => event.getFirstPropertyValue("uid") === "tentative-preview");
  assert(preview, "tentative UID");
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
  const confirmedIds = new Set(confirmed.map((event) => event.id));
  assert(confirmedIds.has("2098685367058612394"), "Sep 12 live announced must be confirmed");
  assert(confirmedIds.has("2094252447271366730"), "Aug 31 archive hard must be confirmed");
  assert(!confirmedIds.has("2098612714704891959"), "Astra quality post must not be confirmed");
  for (const event of confirmed) {
    assert(event.type === "reset", "live confirmed type");
    assert(event.preview === false, "live confirmed preview");
    assert(!isBanked(event) && !isForecast(event) && !isBoost(event), "live confirmed not banked/forecast/boost");
    assert(event.announcement_state !== "scheduled" && event.announcement_state !== "preview", "live confirmed not scheduled/preview");
    const source = (event.source ?? "").trim().toLowerCase();
    if (source === "archive") {
      assert(event.confidence === "high", "archive confirmed confidence");
    } else if (source === "live" || source === "operator-observed") {
      assert((event.announcement_state ?? "").trim().toLowerCase() === "announced", "live confirmed announcement_state");
    } else {
      throw new Error(`unexpected confirmed source ${event.source}`);
    }
  }
  for (const event of tentative) {
    assert(event.type === "reset", "live tentative type");
    assert(!isBanked(event) && !isForecast(event) && !isBoost(event), "live tentative not banked/forecast/boost");
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
