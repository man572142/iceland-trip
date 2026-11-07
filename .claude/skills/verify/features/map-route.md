# Map and route overview

The overview is the default right panel: the whole trip on one Leaflet map with daily lines and numbered pins, plus a summary and one row per night with area search links. Road geometry comes from a public routing server, and the page must stay usable when that server or the map library is gone.

## Sub-features

- `map-overview` shows pins, summary and night rows.
- `map-stay` sends 住宿 to Booking with dates, party size and price cap. 加油 and 超市 stay on Google.
- `map-roads` replaces straight lines with road geometry and caches it per segment.
- `map-fuel` adds the distance and fuel line to a spot's popup.
- `map-lines` hides lines with `路線` and keeps the pins.
- `map-tiles` swaps road, satellite and terrain tiles.
- `map-osrm-dead` keeps straight lines and straight-line labels.
- `map-froad` shows the traveller warning when a leg uses an `F` road.
- `map-leaflet-dead` shows a message in place of the map and keeps the list working.

## How to get to it (user POV)

- Open `/`, or choose `全覽` from any other panel.
- Choose `路線`, `地圖`, `衛星` or `地形` in the map toolbar.
- Choose a link in a night row.

## Driving it with driver.mjs

Run all of this with `driver run map-route`. It makes one full round of live OSRM queries, so run it when roads are the point of the change.

Preconditions:

- Baseline state.
- `driver doctor` has no `WARN` for OSRM or the Leaflet CDN.

- **Overview.** Load `/`. `#info h2` reads `全程路線`, `#btnAll` is pressed, `.day-pin` count equals the day count, the first `.route-sum b` equals the spot count, and `.nights .night` count is one less than the day count.
- **Stay link.** Read the `住宿` href in the first `.night`. It is `www.booking.com` with `checkin` on that day, a later `checkout`, `group_adults` and `nflt=price=TWD-…`.
- **Roads.** Wait for `[data-gap="0"]` to contain `車程`. `LINES.gap0` then has more than two points.
- **Cache.** Wait for `ROADS_KEY` in `localStorage` to have entries, then reload. No request goes to the OSRM host.
- **Fuel line.** Open a spot past Day 2. `.leaflet-popup-content .pop-fuel` matches `距上一站 … 油費$`.
- **Lines.** Choose `#btnRoute`. Dashed paths in `.leaflet-overlay-pane` go to zero and `.day-pin` stays. Choose it again to restore them.
- **Tiles.** Choose `[data-t="k"]`, `[data-t="p"]` and `[data-t="m"]`. `#route img.leaflet-tile` hosts become `arcgisonline`, `opentopomap` and `tile.openstreetmap.org`. `#route` has class `dim` except on `k`.
- **OSRM dead.** New page with the OSRM host blocked. `LINES.gap0` stays at two points, `[data-gap="0"]` starts with `直線`, and `#routeWarn` is not displayed.
- **F road.** New page with OSRM stubbed to return `ref: "F208"`. `#routeWarn` mentions `高地山路` and contains no `OSRM` or road number.
- **Leaflet dead.** New page with the CDN blocked. `#info .lead` reads `地圖載入失敗`, `.map-ph span` says `連不上`, and the day list renders.

## Gotchas

- An empty `#routeWarn` with the `hidden` attribute must compute to `display:none`. A `display` rule on `.route-warn` beats the browser's `[hidden]` style and leaves an empty amber box on the overview. That is a product bug, so do not relax this check.
- The roads cache is written only at the end of a full round. A reload before that refetches everything.
- A stubbed F-road run proves the warning wiring, not whether the current itinerary touches an `F` road. On a live run, read `#routeWarn` in the overview. When it fires, CLAUDE.md describes the `via` fix.
- `fitBounds` animates. Wait for it to finish before clicking by pixel.
