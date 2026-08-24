# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The user and their travel companions (family/friends), planning an Iceland
trip together and referencing the site during the trip itself.

## Product Purpose

A personal itinerary planner for a 16-day Iceland trip (2027/4/30–5/15):
lays out the day-by-day plan as an interactive map with real-world photos so
the group can see where they're going and what it looks like, plus a
separate flight-options comparison page. Success is a clear, browsable plan
the group actually uses while planning and on the road — not a product for
outside users.

## Positioning

Not a market product — no competitors or audience to differentiate against.
Its distinguishing mechanism is practical: a single self-contained HTML page
per surface (no backend, no build step) that pulls real photos live from
Wikimedia Commons per stop, so the itinerary stays visually grounded without
maintaining an image library.

## Operating Context

- Planning phase now, at a desk, iterating on the itinerary content and map.
- On-trip phase later (2027/4/30–5/15): pulled up on mobile in Iceland to
  check the day's stops, lodging, and route.
- Itinerary runs a single clockwise loop around Iceland (Reykjavík → south
  coast → east → north → back), no backtracking.
- Confirmed flights: outbound 4/29–4/30 via Prague to Keflavík; return
  5/16–5/17 via Frankfurt. Source of truth for dates/flights/lodging is
  `iceland_trip_itinerary.md` (written in Traditional Chinese).

## Capabilities and Constraints

- Static site, no framework, no backend, no build step — `public/index.html`
  and `public/flights.html` are each self-contained (inline `<style>` +
  `<script>` with a plain JS data array rendered client-side).
- Hosted on Cloudflare Workers as a static-assets-only Worker
  (`wrangler.jsonc`, `assets.directory: ./public`); pushing to `main`
  auto-deploys.
- Photos are fetched live client-side from the Wikimedia Commons API at page
  view time (no stored images, no API key) — requires network access to
  render.
- Map is a Google Maps `output=embed` iframe, no API key.
- No accounts, no persistence, no analytics.

## Brand Commitments

No formal brand. Existing dark visual theme (near-black background, teal
`--accent`/indigo `--accent-2`/gold accents, Noto Sans TC) is established in
both pages independently (each defines its own `:root` and is expected to
diverge on purpose per page) — see `CLAUDE.md` for the current split.

## Evidence on Hand

Real trip data only: confirmed flights, day-by-day stops, and lodging as
written in `iceland_trip_itinerary.md`. No testimonials, pricing, or
third-party proof needed — this isn't that kind of site. Do not invent trip
content; the itinerary markdown file is canonical for dates/lodging/day
count.

## Product Principles

1. The written itinerary (`iceland_trip_itinerary.md`) is the source of
   truth for trip facts; the HTML pages render it, not the other way round.
2. Keep it a zero-dependency static page — no framework, no build step, no
   backend — so it stays trivial to edit and deploy.
3. Content is for the group, in Traditional Chinese; keep it concise and
   factual (dates, places, logistics), not explanatory.
4. Must hold up as a real trip tool: usable on mobile, legible at a glance,
   reliable enough to check day-of.
