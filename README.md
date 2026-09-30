# Swarm Radio

What does a network of hundreds of AI agents sound like? Swarm Radio is a small static website that
turns live events from the identity.md job network (`https://api.imd.fun/swarm`) into an ambient
audiovisual experience. Every sound is synthesized in the visitor's browser with the Web Audio API;
there are no music files and nothing is recorded or uploaded.

- A new job plays a warm three-note chord.
- An accepted step plays a bright pluck, with one note per role (implement, review, tests, integrate).
- A started step plays a soft filtered breath; a rejected or failed step plays a low minor dyad.
- A completed job plays four rising notes; a failed job plays a falling tone.
- An agent joining plays a high tick and nudges the pulse faster; an agent leaving plays a low tick
  and slows it. The baseline pulse tempo follows the number of agents online.
- A published site plays a slow high shimmer.

Beside every sound the site shows the real event behind it: what happened, when, which agent, which
step, a link to the job on the identity.md explorer and the job objective. Audio starts only after
the visitor presses Play. There is a mute button, a volume slider and a visual-only mode. If the
live feed cannot be reached the site says so and offers a clearly labelled demo built from sample
events.

## Layout

| Path | What it is |
| --- | --- |
| `web/` | Vite + React + TypeScript source, `package.json` and `package-lock.json` |
| `web/src/audio/` | Web Audio engine (`engine.ts`) and event-to-sound mapping (`map.ts`) |
| `web/src/feed/` | API types and diffing, polling hook, scheduler, sample events for the demo |
| `web/src/ui/` | Visualizer canvas, transport controls, feed status, now-playing card, legend, event log |
| `dist/` | Committed production export with relative asset URLs (`base: './'`) |
| `DESIGN.md` | Implemented tokens, typography, components and responsive behaviour |
| `docs/validation.md` | Better Interface review coverage, findings, fixes and verification record (same file delivered as `artifacts/validation.md`) |

## How the feed works

`https://api.imd.fun/swarm` returns one JSON snapshot per request (network health, counts, seat
statistics and the ~60 most recent events of kinds `agent`, `job`, `node`, `done` and `site`). It
sets `Access-Control-Allow-Origin: *` and caches for 10 seconds, so the site polls it every 15 seconds
and plays only the events that were not in the previous snapshot, spread out over the interval so
several new events do not fire at once. When Play is pressed the four most recent events already in
the feed are replayed and tagged "Earlier" so listening starts with sound.

If a request fails, the status line reads "Live feed unavailable", polling keeps retrying, and a
"Play a demo with sample events" button appears. The demo uses `web/src/feed/sample-events.json`, a
real snapshot captured on 2026-09-30 with objectives shortened to one line, plus four synthetic events
(two "agent left", one "step rejected", one "job failed") so every sound can be heard. Demo entries
are tagged "Sample" and the status line says nothing in it is live.

## Install

Requires Node 22 or newer.

```sh
cd web
npm ci
```

## Preview during development

```sh
cd web
npm run dev
```

Vite prints a local URL. The dev server proxies nothing; the browser fetches `api.imd.fun` directly.

## Typecheck, test and rebuild

```sh
cd web
npm run typecheck      # tsc --noEmit
npm test               # vitest: feed parsing, diffing, sound mapping, scheduler, demo playlist
npm run build          # tsc --noEmit && vite build, writes ../dist
```

`npm run build` empties and rewrites `dist/` at the repository root. Commit the result: the publisher
serves the committed export and does not rebuild.

## Preview the production export

```sh
cd web
npm run preview        # serves ../dist
```

Or serve `dist/` with any static file server. The export uses relative URLs, so it also works from a
subpath such as an IPFS gateway path or an ENS name.

## Publish

Publish the `dist/` directory as-is (for example, pin it to IPFS and point an ENS content hash at the
CID). No server-side routing, environment variables or credentials are needed. Only `dist/index.html`,
`dist/favicon.svg` and `dist/assets/*` are required at run time.

## Validation results (worker-side, 2026-09-30)

These were run by the worker that built the site; the network verifier only checks paths and bytes.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Unit tests | `npx vitest run` | 10 tests passed in `src/feed/feed.test.ts` |
| Production build | `npx vite build` | built `dist/index.html`, `assets/index-*.css` (8.8 kB), `assets/index-*.js` (264 kB, 82 kB gzip) |
| Relative asset URLs | inspect `dist/index.html` | `./favicon.svg`, `./assets/index-*.js`, `./assets/index-*.css` |
| Live API shape | `curl https://api.imd.fun/swarm` from the build box | HTTP 200, `access-control-allow-origin: *`, 60 events; the captured document is the unit-test fixture |

Browser checks were run against the committed export with the assignment's Playwright browser tool at
1280×900, 768×900 and 320×720. The browser has no internet access, so the real feed failure state was
exercised naturally, and the live-feed path was exercised by stubbing `fetch` in the page with the
captured snapshot:

- Feed unavailable: status line reads "Live feed unavailable. Could not reach api.imd.fun. Retrying
  every 15 seconds." and the demo button appears. Console shows only the expected failed request.
- Demo: clicking "Play a demo with sample events" starts playback; the log fills with "Sample" rows,
  the now-playing card describes the last sound, ripples draw, and the pulse rises from 73.0 bpm as
  sample agents join. The demo playlist avoids three identical sounds in a row.
- Live (stubbed): status becomes "Live feed connected: 524 agents online", four "Earlier" rows replay,
  and a new `site` event injected on the next poll plays as a live "Shimmer" row while the agent count
  updates to 530.
- Controls: Play toggles to Pause with `aria-pressed`; Mute toggles to Unmute with `aria-pressed`;
  Visual-only disables Mute and Volume and keeps the visuals running; Pause stops scheduled events.
- Keyboard: Tab reaches "Skip to content" first, the amber 2px focus ring is visible on the demo button,
  Enter starts the demo and focus lands on the Pause button.
- Layout: `scrollWidth` equals the viewport at 320, 768 and 1280; no element extends past the right edge.
- Reduced motion (emulated): ripples render at a fixed radius and fade instead of expanding; the field
  stops rotating.

Limitations, stated honestly:

- Sound could not be heard in the headless browser. The Web Audio graph was constructed and ran
  without console errors, and the engine is exercised by the same code path, but timbre and loudness
  were tuned by design, not by listening on this box.
- The real network was not reached from the browser tool; the live path was checked with a stubbed
  `fetch` returning a real captured document. The API was reached from the shell with `curl`.
- No screen-reader session, no physical device, no native browser zoom test. Accessibility snapshots
  from Playwright were used to confirm names, roles and states.
- Screenshots were inspected inline in the browser tool; the tool could not write image files into
  this repository, so none are committed.
