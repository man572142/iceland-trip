# Iceland trip verification map

This directory is the maintained source for verifying the site's user-facing behavior. Read the index, then use the matching feature file as the recipe.

## Baseline preconditions

- `driver up` reports `READY`, and `driver doctor` has no `FAIL`. `driver` means `node .claude/skills/verify/driver.mjs`, run from the repo root.
- Drive only an instance started by this checkout's `driver up`.
- A journey starts from an empty `localStorage`, so a fresh visitor sees the clockwise route and no draft.

## Driving conventions

- Each feature has one journey with the same name. `driver run <feature>` runs every bullet in that feature's recipe.
- Run one bullet alone by copying its handles into an ad-hoc journey. SKILL.md shows the shape.
- Journeys block the OSRM host unless the feature is about roads. This keeps load off a public demo server.
- Handles in the recipes are stable: ids, `data-*` attributes, ARIA state, and UI labels.

## Proof and skip reporting

- Each step leaves `NN.png`, `NN.aria.txt` and an entry in `report.json` under `evidence/<run-id>/<feature>/`.
- A journey that a `doctor` `WARN` explains is an external outage. Report it as unverified, with the service name.
- A check that fails while the app behaves as this map describes is drift in the map. A check that fails while the map is right is a product bug. Report the bug and leave the check as it is.

## Feature entry contract

Each feature file has an H1, one paragraph, then these H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with driver.mjs`, `Gotchas`.

## Features

- [Itinerary list](./itinerary-list.md) covers the day list, expand and collapse, the 只看待決定 filter, and search.
- [Route direction](./route-direction.md) covers the 順時針／逆時針 switch, mirroring, and persistence.
- [Map and route overview](./map-route.md) covers the overview panel, roads, stay links, tile and line buttons, and the failure fallbacks.
- [Spot detail](./spot-detail.md) covers selecting a spot, photos, the lightbox, map pins, and the phone bottom sheet.
- [Edit draft](./edit-draft.md) covers adding, moving and removing spots, draft persistence, and the 更新行程 issue link.
- [Flights page](./flights.md) covers navigation, the confirmed flights, and the price archive.

## Not mapped yet

- `public/review.html`: a static report with no script behaviour, not linked from the nav. Open `/review` and read it.
- `public/photo-debug.html`: a photo source diagnostic page.
- `.github/workflows/itinerary-update.yml` with `tools/apply_edits.mjs`: runs on GitHub, not in a browser. `node tools/check_itinerary.mjs` is the local gate. `edit-draft` proves only the payload the page sends to it.
