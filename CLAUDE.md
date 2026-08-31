# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A static site for planning an Iceland trip. It renders the itinerary as an
interactive map with real-world photos, plus a separate page comparing
flight options. There is no build step, no framework, and no backend —
everything is hand-written HTML/CSS/vanilla JS.

The trip's actual content (dates, day count, regions, stops) lives entirely
in `public/index.html` / `iceland_trip_itinerary.md` — it changes often and
is out of scope for this file.

Live site: https://iceland-trip.man572142.workers.dev/

## Files

- `public/index.html` — the main itinerary page: day-by-day list (left) +
  Google Maps embed and photo gallery (right). This is the site.
- `public/flights.html` — flight option comparison page, linked from the
  header nav on `index.html`. Same dark visual theme, independent data/script.
- `public/review.html` — 行程體檢報告，只列尚未解決的項目（車程負荷、缺席景點、
  同質性、深度）。頂部有一段防回歸註記（無極光、Day 9 住 Mývatn、海鸚在
  Hafnarhólmi）——修行程時先看那段。自成一頁，不共用 `index.html` 的樣式，
  也未從導覽列連入。
- `public/_headers` — static response headers (Cloudflare Pages/Workers
  convention: `X-Content-Type-Options`, `Referrer-Policy`).
- `iceland_trip_itinerary.md` — the canonical written plan in Chinese
  (day-by-day notes, lodging table). Not deployed — see "Making changes"
  below for how it relates to `index.html`.
- `wrangler.jsonc` — Cloudflare Workers config. This is a **static-assets-only
  Worker** (no Worker script) — `assets.directory` points at `public/`. This
  is Workers, not Pages, despite the static-hosting look; don't add
  `pages_build_output_dir`, it's ignored here.

## Architecture notes

**Everything lives in the HTML files.** Both `index.html` and `flights.html`
are single self-contained files: `<style>` block, then a `<script>` block
with a plain JS data array (`DAYS` in index.html; `OLD_FLIGHTS`/`NEW_FLIGHTS`
in flights.html) that's rendered into the DOM on load. There's no bundler, no
npm dependencies, no JSX — edit the array literal and the render functions
directly.

**Itinerary data shape** (`DAYS` in `public/index.html`): each day has
`n`, `title`, `date`, `stay`, `note`, `km`, `drive` (net driving hours,
`null` on the Reykjavík day — both taken from the load table in
`review.html`), and a `spots[]` array. Each spot has `name`, `zh` (Chinese
name), `lat`/`lng`/`z` (map zoom), `desc`, `q` (the search query used
against Wikimedia), `type` (see below), and optional `opt: true` (side trip
/ optional activity) or `kind: "city"` (transit hub or town, styled
differently from a sightseeing spot).

**Decision fields on a spot** — the page exists to settle what stays in the
plan, so beyond `desc`（這是什麼）a spot may carry `hook`（看點：你會經歷什麼）,
`dwell` (minutes), `walk`, `fee`, `book` (a string; presence marks the spot
待決定), `may`（5 月初的開放實況）and `tradeoff`（純事實的排程約束）. All are
optional and render only where present, but `hook`, `dwell` and `type` are
currently on all 77 spots — keep it that way when adding one, or the day's
budget row and the homogeneity counter go quiet for that day.

`type` is on every spot and drives two things: the chip in the left column,
and the 「全程第 N／M 個瀑布」 counter in the detail panel, which is how
homogeneity（9 瀑布、17 城鎮、10 海岸）becomes visible while deciding. Keys
live in the `TYPES` map at the top of the script — reuse one, don't invent a
key without adding it there. Type by *experience*, not by administrative
label: Hofsós is `bath` (the cliff pool is the reason to stop), not `town`.

`fixed: true` marks a spot the group has settled on. It keeps the 需預約
chip (you still have to book it) but drops out of 待決定 — that's the whole
point, so as decisions land, set `fixed` rather than deleting `book`.

Two derived views sit on this data: each day's `budget` row (net driving +
summed `dwell`, on a shared 12 h ruler) and the 「只看待決定」 filter
(`opt` or `book`, minus `fixed`). Both degrade quietly when `dwell` is
missing.

**Photos are fetched live, client-side, at page view time** — not stored in
the repo. `loadPhotos()` queries the Wikimedia Commons API
(`commons.wikimedia.org/w/api.php`, `origin=*` for CORS, no API key) using
each spot's `q` field, falling back to a Wikipedia page-summary thumbnail if
Commons returns nothing. This means the page needs network access to show
images, and photo quality/relevance depends on tuning the `q` search string
per spot, not on any local asset.

**Google My Maps round-trip lives in `index.html`** (header button 「我的地圖」).
My Maps has no public API, so there is no live sync — only files. Export
builds KML (one `<Folder>` per day, `ExtendedData` columns) and CSV from
`DAYS`; import parses KML/CSV/GPX in the browser, matches each point against
`DAYS` by normalised name or 300 m proximity, lists unmatched ones as an
extra 「匯入」 group in the left column (kept in `localStorage`, key
`iceland-trip:mymaps:v1`), and can copy them as a `DAYS` snippet to paste
into this file. KMZ is not supported — export as KML.

**Map is a Google Maps `output=embed` iframe**, built from `lat`/`lng`/`z`,
no API key required. Map type (road/satellite/terrain) is toggled by
rewriting the iframe `src`.

**Two color themes exist and diverge on purpose**: `index.html` and
`flights.html` each define their own `:root` CSS variables and are not
sharing a stylesheet. If you change the palette in one, check whether the
other should match.

## Making changes

- **Editing the itinerary** (add/remove a day, move a stop, fix a
  description): edit the `DAYS` array in `public/index.html` directly. Keep
  `iceland_trip_itinerary.md` in sync if the change affects the narrative
  plan (dates, lodging, day count) — it's the canonical write-up.
- **Adding a new stop**: needs `name`, `zh`, `lat`, `lng`, a reasonable `z`
  (14–17 depending on how tight the location is), `desc`, `type`, and a `q`
  string specific enough that Wikimedia Commons returns the right place
  (plain city names often collide with unrelated results — qualify with
  country/region words as seen in existing entries). Add the decision fields
  too if the surrounding day already has them.
- **Writing a `hook`**: state what you do or see there, not why it rates —
  「能繞到水簾正後方，從內側回頭看水幕」, not 「必看」. No scores, no rankings;
  the facts are what the group decides on. Same for `tradeoff`: give the
  arithmetic（這天已 4.2 h，加上這 2.5 h 等於 6.7 h）, not a recommendation.
  Prices and opening dates change yearly — keep them hedged（約、通常）and
  point at the source to re-check (road.is, ust.is, the operator's site).
- **No build/lint/test commands** — this is plain HTML/CSS/JS served as-is.
  Validate changes by opening the file in a browser or running
  `npx wrangler dev` for a local preview against the real Worker config.
- **Deployment is automatic**: pushing to `main` builds and deploys via
  Cloudflare Workers. Manual deploy (`npx wrangler deploy`) is rarely needed.
- Content in this repo (itinerary notes, spot descriptions, UI text) is
  primarily in Traditional Chinese (zh-Hant) — match that when adding or
  editing user-facing text.
- **Keep all writing concise, not explanatory** — this applies to the
  itinerary (`iceland_trip_itinerary.md`, `index.html`), spot/day
  descriptions, and this file. State dates, places, and facts directly;
  don't add design-philosophy intros or "why this is better" rationale
  sections. Open with the schedule, not an explanation of it.
