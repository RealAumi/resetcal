import { eventWindow, fetchFeed, selectEvents, windowHash } from "./feed";
import { buildCalendar, eventSeqKey, nextSequence } from "./ics";
import { recentConfirmed, subscribePage } from "./page";
import type { Env, Feed, FeedEvent, SeqRecord } from "./types";

const FEED_KEY = "feed:json";
const LAST_FETCH_KEY = "meta:lastFetch";

async function loadCachedFeed(kv: KVNamespace): Promise<Feed | null> {
  return kv.get<Feed>(FEED_KEY, "json");
}

async function saveFeed(kv: KVNamespace, feed: Feed, fetchedAt: string): Promise<void> {
  await kv.put(FEED_KEY, JSON.stringify(feed));
  await kv.put(LAST_FETCH_KEY, fetchedAt);
}

async function refresh(kv: KVNamespace): Promise<{ feed: Feed; fetchedAt: string }> {
  const feed = await fetchFeed();
  const fetchedAt = new Date().toISOString();
  await saveFeed(kv, feed, fetchedAt);
  await persistSequences(kv, feed, fetchedAt);
  return { feed, fetchedAt };
}

async function persistSequences(kv: KVNamespace, feed: Feed, nowIso: string): Promise<void> {
  const now = new Date(nowIso);
  const events = [
    ...selectEvents(feed, "confirmed", now),
    ...selectEvents(feed, "tentative", now),
  ];
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const win = eventWindow(event);
    if (!win) continue;
    const key = eventSeqKey(event.id);
    const prev = await kv.get<SeqRecord>(key, "json");
    const next = nextSequence(prev, windowHash(win));
    if (!prev || prev.hash !== next.hash || prev.sequence !== next.sequence) {
      await kv.put(key, JSON.stringify(next));
    }
  }
}

async function sequencesFor(kv: KVNamespace, events: FeedEvent[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const event of events) {
    const win = eventWindow(event);
    if (!win) continue;
    const key = eventSeqKey(event.id);
    const prev = await kv.get<SeqRecord>(key, "json");
    const next = nextSequence(prev, windowHash(win));
    if (!prev || prev.hash !== next.hash) {
      await kv.put(key, JSON.stringify(next));
    }
    map.set(event.id, next.sequence);
  }
  return map;
}

async function feedForRequest(kv: KVNamespace): Promise<Feed> {
  try {
    const fresh = await refresh(kv);
    return fresh.feed;
  } catch {
    const cached = await loadCachedFeed(kv);
    if (cached) return cached;
    throw new Error("feed unavailable");
  }
}

function icsResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

async function calendarResponse(kv: KVNamespace, kind: "confirmed" | "tentative"): Promise<Response> {
  const feed = await feedForRequest(kv);
  const events = selectEvents(feed, kind);
  const sequences = await sequencesFor(kv, events);
  return icsResponse(buildCalendar(events, kind, sequences));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/") {
        let recent: FeedEvent[] = [];
        try {
          const feed = await feedForRequest(env.RESETCAL);
          recent = recentConfirmed(selectEvents(feed, "confirmed"));
        } catch {
          // Keep subscribe links even if the feed is unavailable.
        }
        return new Response(subscribePage(recent), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }
      if (path === "/health") {
        const lastFetch = await env.RESETCAL.get(LAST_FETCH_KEY);
        return Response.json({
          ok: true,
          lastFetch: lastFetch ?? null,
        });
      }
      if (path === "/calendar.ics") {
        return calendarResponse(env.RESETCAL, "confirmed");
      }
      if (path === "/calendar-tentative.ics") {
        return calendarResponse(env.RESETCAL, "tentative");
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "error";
      if (path.endsWith(".ics")) {
        const empty = buildCalendar([], path.includes("tentative") ? "tentative" : "confirmed", new Map());
        return icsResponse(empty);
      }
      return new Response(message, { status: 502 });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await refresh(env.RESETCAL);
  },
};
