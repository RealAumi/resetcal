const COPY = "resetcal — unofficial Codex reset calendar. Not OpenAI. Not your quota.";

export function subscribePage(origin: string, host: string): string {
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
    footer { color: #8a8a8a; font-size: 0.92rem; }
    footer a { color: #bdbdbd; }
  </style>
</head>
<body>
  <main>
    <h1>resetcal</h1>
    <p>${COPY}</p>
    <div class="actions">
      <a class="primary" href="${webcalConfirmed}">Subscribe to confirmed</a>
      <a class="fallback" href="${httpsConfirmed}">https fallback</a>
    </div>
    <div class="actions">
      <a href="${webcalTentative}">Subscribe to tentative</a>
      <a class="fallback" href="${httpsTentative}">https fallback</a>
    </div>
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
