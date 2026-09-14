import { eventWindow, windowHash } from "./feed";
import type { FeedEvent, SeqRecord, WindowTimes } from "./types";

const CRLF = "\r\n";
const MAX_OCTETS = 75;

export const CALNAMES = {
  confirmed: "Codex resets (confirmed)",
  tentative: "Codex resets (tentative)",
} as const;

export const EVENT_SUMMARY = "Codex reset";

function utf8Len(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** RFC 5545 line folding at 75 octets. Continuation lines start with a space. */
export function foldLine(line: string): string {
  if (utf8Len(line) <= MAX_OCTETS) return line;
  const bytes = new TextEncoder().encode(line);
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const budget = first ? MAX_OCTETS : MAX_OCTETS - 1;
    let end = Math.min(offset + budget, bytes.length);
    while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    if (end === offset) end = Math.min(offset + budget, bytes.length);
    const chunk = decoder.decode(bytes.slice(offset, end));
    parts.push(first ? chunk : ` ${chunk}`);
    first = false;
    offset = end;
  }
  return parts.join(CRLF);
}

export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

export function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildEventLines(
  event: FeedEvent,
  win: WindowTimes,
  status: "CONFIRMED" | "TENTATIVE",
  sequence: number,
  dtstamp: Date,
): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}`,
    `DTSTAMP:${formatUtc(dtstamp)}`,
    `DTSTART:${formatUtc(win.start)}`,
    `DTEND:${formatUtc(win.end)}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    `SUMMARY:${escapeText(EVENT_SUMMARY)}`,
  ];
  if (event.summary) {
    lines.push(`DESCRIPTION:${escapeText(event.summary)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(
  events: FeedEvent[],
  kind: "confirmed" | "tentative",
  sequences: Map<string, number>,
  now = new Date(),
): string {
  const status = kind === "confirmed" ? "CONFIRMED" : "TENTATIVE";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//resetcal//codex resets//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${CALNAMES[kind]}`,
  ];

  for (const event of events) {
    const win = eventWindow(event);
    if (!win) continue;
    const sequence = sequences.get(event.id) ?? 0;
    const dtstamp = event.announced_at ? new Date(event.announced_at) : win.start;
    lines.push(...buildEventLines(event, win, status, sequence, Number.isNaN(dtstamp.getTime()) ? now : dtstamp));
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

export function nextSequence(prev: SeqRecord | null, hash: string): SeqRecord {
  if (!prev) return { hash, sequence: 0 };
  if (prev.hash === hash) return prev;
  return { hash, sequence: prev.sequence + 1 };
}

export function eventSeqKey(id: string): string {
  return `seq:${id}`;
}

export { windowHash };
