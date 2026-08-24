# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A static site for planning a 16-day Iceland trip (南岸 + 西部半島 + 北冰島).
It renders the itinerary as an interactive map with real-world photos, plus a
separate page comparing flight options. There is no build step, no framework,
and no backend — everything is hand-written HTML/CSS/vanilla JS.

Live site: https://iceland-trip.man572142.workers.dev/

## Files

- `public/index.html` — the main itinerary page: day-by-day list (left) +
  Google Maps embed and photo gallery (right). This is the site.
- `public/flights.html` — flight option comparison page, linked from the
  header nav on `index.html`. Same dark visual theme, independent data/script.
- `public/_headers` — static response headers (Cloudflare Pages/Workers
  convention: `X-Content-Type-Options`, `Referrer-Policy`).
- `iceland_trip_itinerary.md` — the source-of-truth written plan in Chinese
  (day-by-day notes, lodging table, rationale). Not deployed; used as
  reference when the itinerary data in `index.html` needs updating.
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
`n`, `title`, `date`, `stay`, `note`, and a `spots[]` array. Each spot has
`name`, `zh` (Chinese name), `lat`/`lng`/`z` (map zoom), `desc`, `q` (the
search query used against Wikimedia), and optional `opt: true` (side trip /
optional activity) or `kind: "city"` (transit hub or town, styled
differently from a sightseeing spot).

**Photos are fetched live, client-side, at page view time** — not stored in
the repo. `loadPhotos()` queries the Wikimedia Commons API
(`commons.wikimedia.org/w/api.php`, `origin=*` for CORS, no API key) using
each spot's `q` field, falling back to a Wikipedia page-summary thumbnail if
Commons returns nothing. This means the page needs network access to show
images, and photo quality/relevance depends on tuning the `q` search string
per spot, not on any local asset.

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
  (14–17 depending on how tight the location is), `desc`, and a `q` string
  specific enough that Wikimedia Commons returns the right place (plain city
  names often collide with unrelated results — qualify with country/region
  words as seen in existing entries).
- **No build/lint/test commands** — this is plain HTML/CSS/JS served as-is.
  Validate changes by opening the file in a browser or running
  `npx wrangler dev` for a local preview against the real Worker config.
- **Deployment is automatic**: pushing to `main` builds and deploys via
  Cloudflare Workers. Manual deploy (`npx wrangler deploy`) is rarely needed.
- Content in this repo (itinerary notes, spot descriptions, UI text) is
  primarily in Traditional Chinese (zh-Hant) — match that when adding or
  editing user-facing text.
