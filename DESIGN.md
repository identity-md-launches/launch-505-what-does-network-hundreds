# Swarm Radio design documentation

Documents the implemented design of the final source in `web/src/`. Values are taken from
`web/src/styles.css`, the React components in `web/src/ui/` and the canvas code in
`web/src/ui/Visualizer.tsx`. Rendered behaviour marked "observed" was seen in the assignment's
Playwright browser at 1280×900, 768×900 and 320×720; everything else is stated from source.

## Direction

A single dark page that behaves like a small radio. The canvas is the main surface, the transport
sits directly under it, and a log on the right explains every sound with the real event behind it.
The palette is deliberately low-key so the coloured event ripples, swatches and the amber primary
button carry the attention. There is one theme (dark) and no light variant; `color-scheme: dark` is
declared on `:root` and in the document `<meta name="color-scheme">`.

## Colour tokens (`web/src/styles.css`, `:root`)

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0b0e14` | page background, primary button text (`--accent-ink`) |
| `--surface` | `#131822` | cards, status bar, log entries, legend, canvas frame |
| `--surface-2` | `#1b2230` | secondary buttons |
| `--border` | `#2a3444` | 1px borders, dashed empty state, table rules |
| `--text` | `#e8edf5` | body text |
| `--text-muted` | `#a3afc2` | secondary text, labels, timestamps |
| `--accent` | `#f4c26b` | primary Play/Pause button, skip link, range and checkbox `accent-color`, canvas centre pulse |
| `--link` | `#9cc8ff` | links and the "Job objective" disclosure summary |
| `--ok` | `#7ee2a8` | status dot when the live feed is connected |
| `--warn` | `#ffb4a3` | status dot and border tint when the feed is unavailable, audio error note |
| `--focus` | `#f4c26b` | `:focus-visible` outline, 2px solid, 2px offset |

Event hues are numbers, not tokens, because they feed both CSS and canvas: each sound carries a
`hue` (`web/src/audio/map.ts`) rendered as `hsl(var(--hue) 75% 65%)` for swatches and the 4px
left border of cards, and as `hsl(hue 80% 68% / alpha)` for canvas ripples. Hues: job 40, implement
160, review 212, tests 262, integrate 350, step started 190 (or the role hue), rejected 10,
completed 90, failed 0, agent join/leave 200, site 300.

Measured contrast (WCAG relative luminance, computed from the hex values): text on bg 16.4:1, text on
surface 15.1:1, muted on surface 8.0:1, primary button text on accent 11.8:1, link on bg 11.2:1,
warn on bg 11.3:1, focus ring on bg 11.8:1 and on surface 10.8:1. Non-text swatches range from 4.4:1
(hue 262) to 12.2:1 (hue 90) against `--surface`. Swatches are always paired with a text label.

## Typography

- Family: `--font-sans` is the system UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI",
  Roboto, "Helvetica Neue", Arial, sans-serif`). `--font-mono` is the system monospace stack, used
  for job ids, step names and log timestamps.
- Scale: `--text-xs` 0.8125rem (stat labels, tags, table headers, uppercase with 0.04em tracking),
  `--text-sm` 0.875rem (status line, meta, descriptions, legend), `--text-md` 1rem (body),
  `--text-lg` 1.125rem (h2, stat values, now-playing title), `--text-xl` `clamp(1.5rem, 1.2rem +
  1.5vw, 2rem)` (h1).
- Weights: 700 for the h1 and section headings, 600 for buttons, stat values, sound labels and the
  now-playing title, 500 for log entry titles, 400 elsewhere.
- Line height 1.5 on the root. The h1 uses 1.15 with `text-wrap: balance`; the tagline and
  now-playing title use `text-wrap: pretty`.
- Measure: `--measure: 62ch` caps the tagline, descriptions and notes.
- Numbers: `.num` and `.entry__time` use `font-variant-numeric: tabular-nums` so the pulse readout
  and timestamps do not jitter as they update.
- Long strings (ENS names, CIDs, objectives) use `overflow-wrap: anywhere`; objectives keep line
  breaks with `white-space: pre-line`.

## Spacing, radii and sizes

- Spacing scale: `--space-1` 0.25rem, `--space-2` 0.5rem, `--space-3` 0.75rem, `--space-4` 1rem,
  `--space-5` 1.5rem, `--space-6` 2rem. Page gutters are `--space-4`; the header and main column are
  capped at 80rem and centred.
- Radii: `--radius-sm` 6px (skip link), `--radius-md` 10px (buttons, cards, status bar),
  `--radius-lg` 14px (canvas).
- Controls: `--control-height` 2.75rem (44px) for buttons and the range input; checkbox and radio
  labels are 2.5rem tall and the whole label is the hit target. Primary button min width 7rem,
  secondary 5.5rem.

## Components

- **Skip link** (`.skip-link`): visually parked off-canvas, appears top-left on focus in accent
  colours; targets `<main id="main">`. Observed as the first Tab stop.
- **Header** (`.site-header`): h1, tagline with a link to identity.md, and the feed status bar.
- **Feed status** (`.feed`, `web/src/ui/FeedStatus.tsx`): a `role="status"` polite live region with a
  colour dot plus text (never colour alone). Variants: connecting (neutral), live (`--ok` dot),
  unavailable (`--warn` dot and border tint, plus a "Play a demo with sample events" button), demo
  (neutral, states that nothing is live and the capture date).
- **Visualizer** (`.viz`, `<canvas role="img">` with a live `aria-label`): a sunflower spiral of up to
  600 dots, one per online agent, twinkling and slowly rotating; a centre amber pulse that flashes
  on each beat; coloured expanding ripples per event, positioned by a hash of the job id or agent id so
  the same job always lands in the same place. Border and radius match cards. Aspect ratio 4/3
  below 40rem, 16/9 above.
- **Controls** (`.controls`, `web/src/ui/Controls.tsx`): a `role="group"` "Playback" row with Play/Pause
  (`aria-pressed`, `.btn--primary`), Mute/Unmute (`aria-pressed`), a labelled `<input type="range">`
  with an `<output>` percentage; a second row with the "Visual-only mode (no sound)" checkbox and a
  "Source" fieldset of two radios (Live feed, Demo). Mute and Volume are natively `disabled` in
  visual-only mode or without Web Audio support, at 50% opacity.
- **Stats** (`.stats`): a `<dl>` of three tiles (Pulse in bpm, Agents online, Working now) on an
  `auto-fit, minmax(8.5rem, 1fr)` grid, so they sit three across on desktop, two-plus-one at 320px.
- **Now playing** (`.now__card`): left border in the sound's hue, "Last sound: label", the event title
  and a one-sentence description with the event time. Idle variant explains what Play does.
- **Legend** (`.legend`): a native `<details>` with a two-column table of event to sound, plus a note
  about the drone and pulse.
- **Event log** (`.log`, `web/src/ui/EventLog.tsx`): h2 "What you heard", newest first, an `<ol>` of
  entries. Each entry: heard time (`<time>`), swatch plus sound label, an optional origin tag
  ("Earlier" or "Sample"; live events carry no tag), the event title, a meta row (happened time, job
  link to the explorer, step name), an optional detail line (reason, failure, CID) and a native
  `<details>` for the full objective. On desktop the list scrolls inside `calc(100dvh - 4rem)` with
  `overscroll-behavior: contain`. New entries fade in over 320ms only under
  `prefers-reduced-motion: no-preference`.
- **Notes** (`.note`, `.note--warn`): small muted text; the audio-start failure note uses `role="alert"`.
- **Footer**: provenance and privacy sentence with links.

## Responsive behaviour

- Below 64rem (1024px) everything is a single column in DOM order: header, status, canvas, controls,
  stats, now playing, legend, log, footer. Observed at 320 and 768 with no horizontal overflow
  (`scrollWidth` equal to the viewport).
- At 64rem and up `.layout` becomes `minmax(0, 1.35fr) minmax(20rem, 1fr)`: stage on the left, log on
  the right, aligned to the top; the log gets its own scroll container.
- Canvas aspect switches from 4/3 to 16/9 at 40rem.
- Control rows wrap with `flex-wrap`; the volume slider flexes between 6rem and 22rem.
- Stat tiles reflow by `auto-fit`; the fix for the 320px wrap of "76.7 bpm" was moving from three
  fixed columns to this rule.
- Hover styling is gated by `@media (hover: hover)` so touch does not leave a stuck hover state.

## Motion and sound behaviour

- Canvas animation runs only while playing or while a ripple or beat flash is decaying; when paused it
  renders a still frame and stops the `requestAnimationFrame` loop.
- Under `prefers-reduced-motion: reduce` (read by `matchMedia` in `App.tsx`) the field does not rotate
  or twinkle, ripples stay at a fixed 28px radius and only fade, beat flashes decay faster, and the
  log entry fade-in is removed. Observed with Playwright media emulation.
- Audio is created only inside the Play handler (`SwarmAudio.start()`), never on load. The drone is
  four detuned oscillators through a low-pass filter with a 0.05 Hz LFO; the pulse is a soft sine kick
  on beats 0 and 2 with a filtered-noise hat on every beat; tempo is 52 + 0.04 × agents online, clamped
  to 40–120 bpm, plus a ±0.8 bpm nudge per join or leave that halves every 25 seconds. A compressor
  on the master bus keeps overlapping events from clipping.

## Forced colours

Under `forced-colors: active` the colour swatches and status dot gain a `1px solid CanvasText`
border so they remain visible; native controls and the default focus outline are otherwise left to
the system palette.
