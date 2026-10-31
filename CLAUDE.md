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
  map and photo gallery (right), with a 順時針／逆時針 switch for the two route
  directions. This is the site.
- `public/flights.html` — flight option comparison page, linked from the
  header nav on `index.html`. Same dark visual theme, independent data/script.
- `public/review.html` — 行程體檢報告，只列尚未解決的項目（車程負荷、缺席景點、
  同質性、深度）。頂部有一段防回歸註記（無極光、住 Mývatn 兩晚、海鸚在
  Hafnarhólmi）——修行程時先看那段。Day 編號與里程表對應**逆時針版**。
  自成一頁，不共用 `index.html` 的樣式，也未從導覽列連入。
- `public/places.json` — ~1,100 candidate places (Wikidata: waterfalls,
  glaciers, craters, beaches, churches, towns…) drawn as grey dots on the map.
  Generated, not hand-edited: `python3 tools/build_places.py` runs
  `tools/places.rq` against query.wikidata.org (class → `type` key and a
  minimum sitelink count per class live in that file's `VALUES`).
- `.github/workflows/itinerary-update.yml` — an issue titled `[行程更新]…`
  opened by the repo owner. Job `apply` runs `tools/apply_edits.mjs` (no AI),
  `tools/check_itinerary.mjs`, pushes to `main` and comments a report. Job
  `polish` runs only when that report lists text to write (new-spot `desc`,
  title/note naming a moved or removed spot): `anthropics/claude-code-action`
  fills it and pushes again. Needs the repo secret `CLAUDE_CODE_OAUTH_TOKEN`
  or `ANTHROPIC_API_KEY`; without one `polish` just comments and stops.
- `tools/` — not deployed. `itinerary.mjs` parses the data in `index.html`
  with acorn and keeps source ranges, so `apply_edits.mjs` replaces only the
  touched `spots` arrays and `km`/`drive` values and leaves every other byte;
  `check_itinerary.mjs` is the gate both jobs must pass. `npm ci --prefix tools`.
- `public/_headers` — static response headers (Cloudflare Pages/Workers
  convention: `X-Content-Type-Options`, `Referrer-Policy`).
- `iceland_trip_itinerary.md` — the canonical written plan in Chinese
  (day-by-day notes, lodging table). Not deployed — see "Making changes"
  below for how it relates to `index.html`.
- `.claude/launch.json` — dev-server entry so the editor's browser preview
  can run `npx wrangler dev`; not part of the deployed site.
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

**Two route directions, one set of spots.** `DAYS_CCW` (南→東→北→西) is where
every spot lives; `DAYS_CW` (西→北→東→南, the default) is its exact mirror: CW day d holds
CCW day 16-d's spot objects in reverse order (`rev(n)`), with its own
title/note/km/drive — Day 1/15/16 are shared. `DAYS` is whichever is active (`ROUTES[dir]`, remembered in
`localStorage` `iceland-trip:dir`); the 順時針／逆時針 buttons call
`switchRoute()`, which rebuilds the list, redraws the route and returns the
right panel to the overview. Consequences:
- Spot text must read the same in both directions — no day numbers or trip
  dates in spot fields (Day 15/16 and Kolaportið's weekend are the exception,
  they are fixed in both). Direction-specific text goes in the day's `note`.
- Add or move a spot in `DAYS_CCW` only; `DAYS_CW` follows. Day boundaries
  are the same in both directions — a move changes both.
- `via` pins a leg in the ccw direction, `viaR` in the cw one (`ROUTES[dir].viaKey`).
- 「全程第 N／M 個」 counters follow the active order (`indexTypes()`).
- A spot belongs to the day whose path passes it. Before placing or moving
  one, compare its insertion cost between the neighbouring stops (OSRM
  `table` distances) — a stop that sits beyond the night's town in the travel
  direction (Kolugljúfur, Bónus Hveragerði) goes to the next morning, not the
  previous evening. Judge it in the ccw direction; the cw day mirrors it.

**Itinerary data shape** (`DAYS` / `DAYS_CCW` in `public/index.html`): each day has
`n`, `title`, `date`, `note`, `km`, `drive` (net driving hours,
`null` on the Reykjavík day — both taken from the load table in
`review.html`), and a `spots[]` array. Each spot has `name`, `zh` (Chinese
name), `lat`/`lng`/`z` (map zoom), `desc`, `q` (the search query used
against Wikimedia), `type` (see below), and optional `opt: true` (side trip
/ optional activity) or `kind: "city"` (transit hub or town, styled
differently from a sightseeing spot).

**Decision fields on a spot** — the page exists to settle what stays in the
plan, so beyond `desc`（這是什麼＋你會看到／經歷什麼，一段話）a spot may carry
`wd` (Wikidata Q-id — set on spots added from the map, ties the spot to its
`places.json` entry), `dwell` (minutes), `walk`, `fee`, `book` (a string; presence marks the spot
待決定), `may`（5 月初的開放實況）and `detour`（繞路的距離與路況，僅 8 站有）. All are
optional and render only where present, but `dwell` and `type` are
currently on all 71 spots — keep it that way when adding one, or the day's
budget row and the homogeneity counter go quiet for that day.

`type` is on every spot and drives two things: the chip in the left column,
and the 「全程第 N／M 個瀑布」 counter in the detail panel, which is how
homogeneity（8 瀑布、14 城鎮、10 海岸）becomes visible while deciding. Keys
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

**One map: Leaflet, in-page.** It is built on load (cdnjs with SRI) and never
replaced — selecting a spot pans it and opens that spot's popup, so the whole
route stays on screen. Google Maps survives only as outbound links
(「在 Google 地圖開啟」, the 住宿／加油／超市 area searches); there is
no `output=embed` iframe and no fallback map, so a Leaflet that never arrives
leaves the placeholder message. One coloured polyline per day, a dashed
segment across each gap between days, a numbered pin at every day's last stop
— the route lives here and not in Google because a `maps/dir/` URL caps at 10
stops. Lines sit in their own layer group so 「路線」
can hide them while the pins stay; 「全覽」 refits to the whole trip and puts
the route summary in the right panel (`body.route-on`). The
road/satellite/terrain buttons swap tile layers (`TILES` maps them to OSM /
Esri imagery / OpenTopoMap; the dark look is a CSS filter on the tile pane,
off for imagery). Layers added before the map has a view throw inside
Leaflet — `buildRoute` sets one first and fits bounds last.

**Road geometry comes from OSRM's public demo server** (`router.project-osrm.org`,
no API key, no uptime guarantee). Segments are drawn straight first and
redrawn as each query lands, so a slow or dead server just leaves straight
lines — that fallback is the feature, don't replace it with a spinner.
Geometry plus each leg's km/minutes is cached in `localStorage`
(`iceland-trip:roads:v5`) per segment, keyed by a hash of that segment's
coordinates, so editing `DAYS` refetches only the segments that moved and the
two directions share what they have in common. A switch mid-fetch bumps
`routeGen`, which stops the old round from painting onto the new lines. The per-leg km also feeds the
「距上一站 … 油費$」 fuel line in each map popup (`fuelLine`; constants
`CAR_L100`／`FUEL_ISK`／`ISK_TWD` sit above `LINES` — rough, 8 L/100 km on
purpose); legs that hit an `F`-road are tagged 「路線僅供參考」.

**OSRM routes by distance, not by season**, and will happily send you over an
`F`-road — highland tracks that are 4x4-only and usually shut until June,
while this trip runs 4/30–15. Every query asks for `steps` purely to read
each step's `ref`; any `F`-prefixed one is collected and named in the amber
`#routeWarn` block. Keep that warning wired to anything that shows an OSRM
duration: the numbers are shortest-path, not plans. When it fires, add a
`via:[[lat,lng],…]` (ccw) or `viaR` (cw) to the spot that ends the offending
leg — those points are inserted before it in the OSRM query (`segments()`) and
pin the line to the paved road (Brúarfoss／Þingvellir via Laugarvatn).
If a stop's own coordinate sits off the road network, the route snaps to the
nearest road — possibly an `F`-road — and a `via` can't fix it; check the
lat/lng first (Saxhóll was 5 km off, which is where its `F575` came from).
The warning text is for travellers: no "OSRM" or road numbers in it.

**Candidates and the draft.** Every `places.json` entry that doesn't match an
itinerary spot (same `wd`; within 60 m; the same name within 15 km —
Wikidata coordinates are often several km off; or within 4 km with one name
containing the other, not for towns or transit) is a grey canvas dot under the route; fewer at low zoom
(`MIN_SL`, by sitelink count), labels from z 11. A spot removed from the plan
becomes an amber ring. Clicking either opens the same right panel as a spot
(Wikipedia intro — zh-TW when a zh article exists — plus photos) with a day
picker; spots in the plan get 移到這天／從行程移除. Each option shows the
straight-line detour, and the spot lands in the cheapest slot (`bestSlot`,
including the previous night's last stop and the next morning's first).
Changes are `EDITS` (`[key, ccwDay]`, 0 = removed; key = spot name, or the
Q-id for added places) in `localStorage` `iceland-trip:edits:v1`.
`applyEdits()` replays them on `BASE_SPOTS` (a copy of `DAYS_CCW` taken at
load) and re-mirrors `DAYS_CW`, so an edit that already matches the deployed
data drops itself. 更新行程 (header) lists the changes and opens a prefilled
GitHub new-issue URL (body: readable list + JSON; over 7,000 chars it goes
via the clipboard). The JSON is `{v:1, days:{ccwN:[keys…]}, add:{Qid:{…}}}`:
the full final order of every touched day, so the workflow reproduces the
page's order exactly and refuses an issue whose keys no longer match `main`.
A spot added this way lands with `desc:""` (the page shows the Wikipedia
intro instead), `zh` = name and a per-type default `dwell` until `polish`
writes them. km/drive move by the OSRM difference (the day's path in full,
the two overnight legs half each), not a full recompute. Until deployed, the
page keeps old km/drive on touched days and shows 已修改.

**Lodging is never named in `DAYS`.** The overview gives each night the leg
it falls on and Google 區域搜尋 links (住宿／加油／超市) centred there, so what
an area actually has is read off the live map. An earlier version listed
overnight towns and had no way to know any were bookable — don't reintroduce
guessed towns as data.

住宿 links go to Booking.com, not Google Maps, because a Maps search URL can't
carry dates or party size. `stayUrl()` fills check-in (that day) / check-out
(next day), `GUESTS` adults, the coordinates and a nightly price cap
(`STAY_MAX`, NT$, per night); `TRIP_YEAR`, `GUESTS` and `STAY_MAX` sit above
`nearLinks`. The last day has no night (red-eye flight) and falls back to
the Google search. 加油／超市 stay on Google.

**Two color themes exist and diverge on purpose**: `index.html` and
`flights.html` each define their own `:root` CSS variables and are not
sharing a stylesheet. If you change the palette in one, check whether the
other should match.

## Making changes

- **Editing the itinerary** (add/remove a day, move a stop, fix a
  description): edit `DAYS_CCW` (spots) and `DAYS_CW` (day grouping) in
  `public/index.html` directly. Keep `iceland_trip_itinerary.md` in sync if
  the change affects the narrative plan (dates, day count) — it's the
  canonical write-up and holds both directions.
- **Adding a new stop**: needs `name`, `zh`, `lat`, `lng`, a reasonable `z`
  (14–17 depending on how tight the location is), `desc`, `type`, and a `q`
  string specific enough that Wikimedia Commons returns the right place
  (plain city names often collide with unrelated results — qualify with
  country/region words as seen in existing entries). Add the decision fields
  too if the surrounding day already has them.
- **Writing a `desc`**: one paragraph — what the place is, then what you do or
  see there, not why it rates —「能繞到水簾正後方，從內側回頭看水幕」, not
  「必看」. No scores, no rankings; the facts are what the group decides on.
  Each fact lives in one field only: times and distances in `dwell`／`walk`,
  prices in `fee`, reservations in `book`, seasonal status in `may` — don't
  repeat them in `desc` or `detour`. Every field must read on its own — no
  "這天已 N h"、no pointers to other days or spots, no recommendations;
  cross-day arithmetic lives in the day's budget row and `note`. `detour`
  holds only the extra distance/road condition of a side road（來回 54 km、
  礫石路）; leave it out otherwise. A tip that isn't a reservation (「旺季建議
  先訂位」) goes in `desc`, not `book`, or the spot turns 待決定.
  Prices and opening dates change yearly — keep them hedged（約、通常）and
  point at the source to re-check (road.is, ust.is, the operator's site).
- **Verify before reporting done.** Load the page in Chromium (Playwright,
  `python3 -m http.server` on `public/`), exercise the changed behaviour, read
  the actual DOM/hrefs, and look at a screenshot. Reading code or unit-testing
  a helper is not verification. Say plainly what could not be checked.
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
