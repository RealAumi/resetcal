# resetcal

Unofficial Codex reset calendar. Not OpenAI. Not your quota.

A thin Cloudflare Worker that turns the existing [codex-reset.com](https://codex-reset.com/api/feed) JSON into subscribeable ICS feeds.

## Routes

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/` | One-screen subscribe page |
| `GET` | `/calendar.ics` | Confirmed resets |
| `GET` | `/calendar-tentative.ics` | Tentative / preview / scheduled |
| `GET` | `/health` | Last successful feed fetch time |

Primary subscribe is `webcal://<host>/calendar.ics`, with `https://<host>/calendar.ics` as fallback.

## Filters

Source: `https://codex-reset.com/api/feed` (`events[]`, deduped by `id`).

- **Confirmed** prefers `source === "archive"` AND `type === "reset"` AND `confidence === "high"` AND `preview === false`. Also includes completed live / operator-observed resets (`type === "reset"`, `preview === false`, `announcement_state === "announced"`). Sparse: future or in-flight windows, plus the last 14 UTC calendar days of hard resets (`reset_kind === "hard"`; confirmed candidates with missing `reset_kind` count as hard). The 14-day window is inclusive calendar days: `(utcDay(now) - utcDay(event)) <= 14`, using `event.date` (YYYY-MM-DD) when present, else the UTC date of window start / `announced_at`. Live medium rows do not block those 14-day hits.
- **Tentative** = scheduled / preview resets (`preview === true` and/or scheduled announcement states). Empty is expected when nothing is scheduled or previewed.
- Neither feed includes forecast-% , banked, or boost VEVENTs. Preview/scheduled stay tentative-only. Live/operator-observed resets without `announcement_state === "announced"` are not confirmed.

## Local

```bash
npm install
npx wrangler dev
```

Then:

- http://127.0.0.1:8787/
- http://127.0.0.1:8787/calendar.ics
- http://127.0.0.1:8787/calendar-tentative.ics
- http://127.0.0.1:8787/health

Validate ICS:

```bash
npm run validate-ics
```

`wrangler dev` uses simulated KV. Real Cloudflare KV IDs are only required for deploy.

## Deploy (boss / local token)

Do **not** commit a Cloudflare token. Worker name is **`resetcal`**. Run these from this repository directory.

1. Log in (or export `CLOUDFLARE_API_TOKEN` in your shell):

   ```bash
   npx wrangler login
   ```

2. Create the KV namespace (and a preview namespace):

   ```bash
   npx wrangler kv namespace create RESETCAL
   npx wrangler kv namespace create RESETCAL --preview
   ```

3. Paste the printed IDs into `wrangler.toml`:

   ```toml
   [[kv_namespaces]]
   binding = "RESETCAL"
   id = "<id from namespace create>"
   preview_id = "<id from namespace create --preview>"
   ```

   Replace the placeholder `000000…0001` / `000000…0002` values currently in `wrangler.toml`. Deploy will fail until those IDs are real namespaces in your account.

4. Deploy to workers.dev:

   ```bash
   npx wrangler deploy
   ```

Cron is already set to `*/10 * * * *` (every 10 minutes). After deploy, the live URL is:

```text
https://resetcal.<your-account>.workers.dev
```

Custom domains are out of scope for this worker.
