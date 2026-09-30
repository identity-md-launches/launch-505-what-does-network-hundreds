# Swarm Radio: validation and Better Interface review

Worker-side record for the `dist/` export built on 2026-09-30 from `web/src/`. This is the worker's
own report, not an independent certification.

## 1. Scope and assumptions

- One page, hash-free, single route: `dist/index.html` plus `dist/assets/*` and `dist/favicon.svg`.
- Flows reviewed: first load with the feed unavailable; starting the labelled demo; the live feed
  connecting, replaying recent events and playing a newly arrived event; Play/Pause, Mute, Volume,
  Visual-only mode and Source switching; keyboard traversal; reduced motion.
- Inferred choices: `https://api.imd.fun/swarm` is a polled snapshot, not a stream, so the site polls
  every 15 s (the API caches for 10 s) and diffs events by a composite key. Four recent events are
  replayed on Play so listening starts with sound; they are tagged "Earlier". The demo mixes a real
  captured snapshot with four synthetic events so every sound can be demonstrated; all demo rows are
  tagged "Sample" and the status line says nothing is live.
- Variants: dark theme only. No localisation, no dialogs, no wallet (not a dapp).
- Exclusions: no screen-reader session, no physical device, no native browser zoom.

## 2. Coverage by domain

| Domain | Status | What was inspected |
| --- | --- | --- |
| Accessibility | Checked | Native `button`/`input`/`details` throughout; every control has a visible label (`label for`, wrapping labels, `aria-pressed` on toggles, `aria-valuetext` on the slider); skip link is the first Tab stop (observed); 2px amber `:focus-visible` ring observed on the demo button; one `h1`, `h2` per section, `header`/`main`/`footer` landmarks; `role="status"` polite region for feed status, `role="alert"` for audio start failure; canvas has `role="img"` with a state-aware label; hit targets: buttons and slider 44px tall, checkbox/radio labels 40px tall; reduced motion honoured in CSS and canvas (observed under emulation). Not verified: screen reader announcements, forced-colors rendering, native 200% zoom. |
| Layout | Checked | Single column under 64rem, two columns above; DOM order matches visual order; observed at 320, 768 and 1280 with `scrollWidth == innerWidth` and no element past the right edge; stat tiles reflow (fixed, see finding 1). |
| Writing | Checked | Button labels are verbs ("Play", "Pause", "Mute", "Unmute", "Play a demo with sample events"); status sentences state the situation and the next step ("Retrying every 15 seconds"); every sound has a one-sentence explanation; consistent terms (agent, job, step, role) across log, legend and card; error note tells the visitor what to do. |
| Typography | Checked | System stack, 5-step scale, 62ch measure, tabular numerals on live counts and timestamps, `overflow-wrap: anywhere` on ids and objectives; h1 wraps cleanly at 320 (observed). |
| Colors | Checked | Tokens in `styles.css`; contrast computed for every text pair (all ≥ 8:1 except disabled controls at 4.47:1, which are exempt) and for non-text swatches (≥ 4.4:1 against `--surface`); status and sound colour always paired with text. Canvas alpha colours over the gradient were not measured. |
| UI details | Checked | Consistent 10px radius, 1px borders, one primary button, disabled states styled, hover gated by `(hover: hover)`, entry fade-in only under no-preference, canvas idles when paused. |

## 3. Findings and fixes

| # | Severity | Location | Evidence | Fix | Recheck |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `web/src/styles.css` `.stats` | At 320px the three fixed columns forced "76.7 bpm" to wrap onto two lines (observed in full-page screenshot). | `grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr))`. | Observed at 320: two tiles per row, values on one line. |
| 2 | Medium | `web/src/ui/Visualizer.tsx` ripple storage | Ripple positions were stored in CSS pixels at creation, so after a resize a ripple drew outside the dot field (observed at 768 after resizing from 320). | Store angle and distance as a fraction of the field radius and resolve per frame. | Observed ripples inside the field after resizing. |
| 3 | Medium | `web/src/feed/sample.ts` | The chronological sample opened with seven consecutive "agent joined" ticks, so the demo did not demonstrate the range of sounds (observed log). | `buildDemoPlaylist` defers an event whose sound matches the two previous ones; unit-tested. | Observed first entries alternate ticks with a review pluck and a job chord. |
| 4 | High | `web/src/App.tsx` `playDemo` | Activating "Play a demo with sample events" with Enter unmounted the button and focus fell to `body` (observed `document.activeElement`). | Focus is moved to the Play/Pause button on the next frame. | Observed: after Enter, `activeElement` is the "Pause" button. |
| 5 | High | `web/src/feed/useSwarmFeed.ts` / `App.tsx` | Switching Source to Live while playing, or pressing Play before the first poll succeeded, never replayed recent events because the hook's cache was empty at that moment (observed: no "Earlier" rows after switching). | The hook now reports its first successful poll (`onFirst`) and the app replays from it; `togglePlay` replays only when a cached snapshot exists. | Observed four "Earlier" rows within 8 s of switching to Live. |

No further findings remain open. Low-severity polish not addressed: the "Source" legend floats
inline and wraps its two radios onto separate lines at 320px; this is readable and operable.

## 4. Verification

Commands (in `web/`, Node 22.23.2, npm 10.9.8):

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx vitest run` | 10 passed, 0 failed (`src/feed/feed.test.ts`) |
| `npx vite build` | exit 0; `dist/index.html` 0.77 kB, `assets/index-*.css` 8.76 kB, `assets/index-*.js` 264.11 kB (81.76 kB gzip) |
| `curl -D - https://api.imd.fun/swarm` (build box) | HTTP 200, `access-control-allow-origin: *`, `cache-control: public, max-age=10`, 60 events |

Browser (Playwright MCP, Chromium, serving the committed `dist/` from `http://127.0.0.1:8899/dist/index.html`; the browser has no internet):

| Viewport | What was done | Observed |
| --- | --- | --- |
| 1280×900 | Load | "Live feed unavailable. Could not reach api.imd.fun. Retrying every 15 seconds." with demo button; console: only the failed `api.imd.fun` request (repeats once per retry). |
| 1280×900 | Tab, Tab, Tab, Enter | Skip link first, focus ring visible, demo starts, focus on "Pause". |
| 1280×900 | Demo running 12 s | 3 to 8 "Sample" rows, ripples, pulse 73.0 → 74.4 bpm after joins, now-playing card updates. |
| 1280×900 | Click Mute, click Visual-only | "Unmute" with `aria-pressed=true`; Mute and Volume disabled; visuals continue. |
| 1280×900 | Emulate `prefers-reduced-motion: reduce` | Fixed-radius fading ripples, no rotation. |
| 1280×900 | Stub `fetch` with the captured snapshot, select Live | "Live feed connected: 524 agents online"; four "Earlier" rows; 15 s later an injected `site` event plays as an untagged live "Shimmer" row and the count reads 530. |
| 1280×900 | Click Pause | Button reads "Play", `aria-pressed=false`, no further rows. |
| 320×720 | Load, demo, full-page screenshot | No horizontal overflow; stats reflow two-plus-one; log readable. |
| 768×900 | Demo | Single column, no overflow. |

Screenshots were inspected inline through the tool. The browser tool could not write files into
this repository (`EROFS` on `artifacts/screenshots/`), so no screenshot files are committed.

## 5. Completion

Complete for the stated scope, with these limitations: audio was not heard on this box (the Web
Audio graph ran without errors in the headless browser); the live API was reached only from the
shell, and the browser exercised the live UI path through a stubbed `fetch` returning a real captured
document; no screen-reader, physical-device or native-zoom checks; no screenshot files.
