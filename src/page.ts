import { eventCalendarDate, eventWindow } from "./feed";
import type { FeedEvent } from "./types";

const COPY = "resetcal — unofficial Codex reset calendar. Not OpenAI. Not your quota.";
export const CADENCE_COPY = "Refreshes about every 15 minutes.";
export const RECENT_CONFIRMED_LIMIT = 8;
export const SUBSCRIBE_HOST = "resetcal.app";
export const SOURCE_HANDLE = "@thsottiaux";

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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
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

export function eventCardTime(event: FeedEvent): string | null {
  if (event.announced_at) {
    const announced = new Date(event.announced_at);
    if (!Number.isNaN(announced.getTime())) {
      return `${announced.getUTCFullYear()}-${pad2(announced.getUTCMonth() + 1)}-${pad2(announced.getUTCDate())} ${pad2(announced.getUTCHours())}:${pad2(announced.getUTCMinutes())} UTC`;
    }
  }
  const date = event.date?.trim();
  return date || null;
}

export function eventCardText(event: FeedEvent): string {
  return (event.summary ?? event.text ?? "").trim();
}

function recentCardsHtml(events: FeedEvent[]): string {
  if (events.length === 0) return "";
  const cards = events
    .map((event) => {
      const href = safeHttpUrl(event.url);
      const time = eventCardTime(event);
      const text = eventCardText(event);
      const inner = `<span class="card-handle">${escapeHtml(SOURCE_HANDLE)}</span>${
        time ? `<time class="card-time">${escapeHtml(time)}</time>` : ""
      }${text ? `<p class="card-text">${escapeHtml(text)}</p>` : ""}`;
      if (href) {
        return `<a class="card" href="${escapeHtml(href)}">${inner}</a>`;
      }
      return `<div class="card">${inner}</div>`;
    })
    .join("");
  return `<h2 class="recent-heading">Recent confirmed</h2>
    <div class="cards">${cards}</div>`;
}

export function subscribePage(recent: FeedEvent[] = []): string {
  const webcalConfirmed = `webcal://${SUBSCRIBE_HOST}/calendar.ics`;
  const httpsConfirmed = `https://${SUBSCRIBE_HOST}/calendar.ics`;
  const webcalTentative = `webcal://${SUBSCRIBE_HOST}/calendar-tentative.ics`;
  const httpsTentative = `https://${SUBSCRIBE_HOST}/calendar-tentative.ics`;

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
    .cards {
      display: grid;
      gap: 0.65rem;
      margin: 0 0 1.25rem;
    }
    .card {
      display: block;
      text-decoration: none;
      color: inherit;
      background: #16181d;
      border: 1px solid #2a2d34;
      border-radius: 16px;
      padding: 0.9rem 1rem;
    }
    a.card:hover {
      border-color: #3d414b;
      background: #1b1e24;
    }
    .card-handle {
      display: block;
      font-weight: 650;
      color: #f4f4f4;
    }
    .card-time {
      display: block;
      color: #8a8a8a;
      font-size: 0.85rem;
      margin: 0.15rem 0 0.45rem;
    }
    .card-text {
      margin: 0;
      color: #ececec;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
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
    ${recentCardsHtml(recent)}
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
