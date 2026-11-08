# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A static site for planning an Iceland trip: the itinerary as an interactive map
with live photos, plus a flights page. Hand-written HTML/CSS/vanilla JS, with
each page a single self-contained file (`<style>`, then a `<script>` holding a
plain data array rendered on load). No build step, framework, npm dependency on
the site, or backend.

Live site: https://iceland-trip.man572142.workers.dev/

## Read before changing

- **Trip content** (a spot, a day, `desc`, decision fields, `title`/`note`/`km`/`drive`):
  [docs/itinerary.md](docs/itinerary.md)
- **Map, routes, photos, stay links** (Leaflet, OSRM, `via`, Booking):
  [docs/map.md](docs/map.md)
- **Candidates, the candidate pool (`tools/candidates.json`), the draft, 更新行程, `tools/`, the update workflow**:
  [docs/edit-pipeline.md](docs/edit-pipeline.md)

## Files

- `public/index.html` — the site: day list (left), map and photo gallery (right).
  Data in `DAYS`, clockwise (西 → 北 → 東 → 南).
- `public/flights.html` — confirmed flights and the price archive, linked from the
  itinerary. Data in `OLD_FLIGHTS` / `NEW_FLIGHTS`.
- `public/review.html` — open issues with the plan; its 「已定案」
  callout lists settled decisions. Styled on its own, not linked from the site.
- `public/photo-debug.html` — photo source diagnostic.
- `iceland_trip_itinerary.md` — the written plan, not deployed.
- `tools/candidates.json` — researched candidates with sources and each one's decision, not deployed.
- `PRODUCT.md` — product context for the `impeccable` design skill.
- `.claude/skills/verify/` — the `verify` skill.
- `.claude/skills/impeccable/`, `.claude/agents/impeccable-*` — vendored design skill;
  leave its prose to upstream.

`index.html` and `flights.html` each define their own `:root` and share no
stylesheet, so a palette change is two edits.

## Making changes

- **Verify before reporting done** with the `verify` skill: load the page in
  Chromium through the real Worker config, exercise the changed behaviour, read
  the actual DOM/hrefs, and look at a screenshot. Reading code, unit-testing a helper
  or a plain static server (it skips the Worker's `.html` redirects and `_headers`)
  proves nothing. Say plainly what could not be checked.
- **Pushing to `main` is deploying.** Cloudflare Workers builds and publishes it.
- **Workers, not Pages:** a static-assets-only Worker, with `assets.directory` in
  `wrangler.jsonc` pointing at `public/`. Configure it through Workers keys;
  `pages_build_output_dir` is ignored.
- **Pages show the plan as it is, not how it got there.** No edit history, corrections,
  retracted advice or resolved issues on any page; `review.html` lists only what is still
  open, and a settled decision is stated in a line with only the facts needed to act on it.
  Rationale a future edit needs goes in `docs/`.
- **Write user-facing text in Traditional Chinese** (itinerary notes, spot
  descriptions, UI).
- **Write concisely** in the itinerary, spot and day text, and these docs. Open with
  the schedule or the fact; state dates, places and facts directly. Leave out
  design-philosophy intros and "why this is better" sections.
