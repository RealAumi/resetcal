export interface OfficialWindow {
  label?: string;
  start_at?: string | null;
  end_at?: string | null;
  target_kind?: string;
  target_at?: string | null;
  time_zone?: string;
}

export interface FeedEvent {
  id: string;
  type?: string | null;
  group?: string | null;
  source?: string | null;
  confidence?: string | null;
  preview?: boolean | null;
  date?: string | null;
  announced_at?: string | null;
  official_window?: OfficialWindow | null;
  url?: string | null;
  summary?: string | null;
  text?: string | null;
  reset_kind?: string | null;
  announcement_state?: string | null;
  time_kind?: string | null;
}

export interface Feed {
  fetched_at?: string;
  events?: FeedEvent[];
}

export interface WindowTimes {
  start: Date;
  end: Date;
}

export interface SeqRecord {
  hash: string;
  sequence: number;
}

export interface Env {
  RESETCAL: KVNamespace;
}
