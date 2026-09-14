import { eventCalendarDate, eventWindow } from "./feed";
import { EVENT_SUMMARY } from "./ics";
import type { FeedEvent } from "./types";

const COPY = "resetcal — unofficial Codex reset calendar. Not OpenAI. Not your quota.";
export const CADENCE_COPY = "约每 15 分钟刷新";
export const RECENT_CONFIRMED_LIMIT = 8;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    return null;
  }
  return null;
}

function eventSortTime(event: FeedEvent): number {
  const day = eventCalendarDate(event, eventWindow(event));
  if (day) return day.getTime();
  return eventWindow(event)?.start.getTime() ?? 0;
}

export function recentConfirmed(events: FeedEvent[], limit = RECENT_CONFIRMED_LIMIT): FeedEvent[] {
  return [...events].sort((a, b) => {
    const byDay = eventSortTime(b) - eventSortTime(a);
    if (byDay !== 0) return byDay;
    const aStart = eventWindow(a)?.start.getTime() ?? 0;
    const bStart = eventWindow(b)?.start.getTime() ?? 0;
    return bStart - aStart;
  }).slice(0, limit);
}

function formatEventDate(event: FeedEvent): string | null {
  const day = eventCalendarDate(event, eventWindow(event));
  if (!day) return null;
  const yyyy = String(day.getUTCFullYear()).padStart(4, "0");
  const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(day.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function eventRowLabel(event: FeedEvent): string {
  const date = formatEventDate(event);
  return date ? `${date} · ${EVENT_SUMMARY}` : EVENT_SUMMARY;
}

function recentListHtml(events: FeedEvent[]): string {
  if (events.length === 0) return "";
  const items = events
    .map((event) => {
      const label = escapeHtml(eventRowLabel(event));
      const href = safeHttpUrl(event.url);
      if (href) {
        return `<li><a href="${escapeHtml(href)}">${label}</a></li>`;
      }
      return `<li>${label}</li>`;
    })
    .join("");
  return `<h2 class="recent-heading">Recent confirmed</h2>
    <ul class="recent">${items}</ul>`;
}

export function subscribePage(origin: string, host: string, recent: FeedEvent[] = []): string {
  const webcalConfirmed = `webcal://${host}/calendar.ics`;
  const httpsConfirmed = `${origin}/calendar.ics`;
  const webcalTentative = `webcal://${host}/calendar-tentative.ics`;
  const httpsTentative = `${origin}/calendar-tentative.ics`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>resetcal</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font: 16px/1.45 ui-sans-serif, system-ui, sans-serif;
      background: #0e0f12;
      color: #ececec;
      padding: 24px;
    }
    main {
      max-width: 36rem;
      width: 100%;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 650;
      letter-spacing: -0.03em;
      margin: 0 0 0.6rem;
    }
    p { margin: 0 0 1.1rem; color: #c8c8c8; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.6rem 0.9rem; margin: 0 0 1.25rem; }
    a {
      color: #f4f4f4;
    }
    a.primary {
      display: inline-block;
      background: #f4f4f4;
      color: #111;
      text-decoration: none;
      padding: 0.55rem 0.85rem;
      border-radius: 999px;
      font-weight: 600;
    }
    a.fallback { color: #9ad; }
    .cadence { color: #c8c8c8; }
    .recent-heading {
      font-size: 1rem;
      font-weight: 650;
      margin: 0 0 0.5rem;
    }
    .recent {
      list-style: none;
      margin: 0 0 1.25rem;
      padding: 0;
    }
    .recent li { margin: 0 0 0.4rem; }
    .recent a { color: #9ad; }
    footer { color: #8a8a8a; font-size: 0.92rem; }
    footer a { color: #bdbdbd; }
  </style>
</head>
<body>
  <main>
    <h1>resetcal</h1>
    <p>${COPY}</p>
    <div class="actions">
      <a class="primary" href="${escapeHtml(webcalConfirmed)}">Subscribe to confirmed</a>
      <a class="fallback" href="${escapeHtml(httpsConfirmed)}">https fallback</a>
    </div>
    <div class="actions">
      <a href="${escapeHtml(webcalTentative)}">Subscribe to tentative</a>
      <a class="fallback" href="${escapeHtml(httpsTentative)}">https fallback</a>
    </div>
    <p class="cadence">${CADENCE_COPY}</p>
    ${recentListHtml(recent)}
    <footer>
      Radar:
      <a href="https://codex-reset.com">codex-reset.com</a>
      ·
      <a href="https://resetbeacon.com">resetbeacon.com</a>
    </footer>
  </main>
</body>
</html>`;
}
