# Map and route

The whole trip sits on one Leaflet map with daily lines and numbered pins; popups carry area search links. Road geometry comes from a public routing server, and the page must stay usable when that server or the map library is gone.

## Sub-features

- `map-overview` shows pins at each day's last stop; the right panel starts as the empty prompt.
- `map-stay` sends 住宿 to Booking with dates, party size and price cap. 加油 and 超市 stay on Google.
- `map-roads` replaces straight lines with road geometry and caches it per segment.
- `map-fuel` adds the distance and fuel line to a spot's popup.
- `map-lines` hides lines with `路線` and keeps the pins.
- `map-tiles` swaps road, satellite and terrain tiles.
- `map-osrm-dead` keeps straight lines and straight-line labels.
- `map-froad` flags a leg that uses an `F` road in the spot popup.
- `map-leaflet-dead` shows a message in place of the map and keeps the list working.

## How to get to it (user POV)

- Open `/`.
- Choose `路線`, `地圖`, `衛星` or `地形` in the map toolbar.
- Choose a link in a pin's popup.

## Driving it with driver.mjs

Run all of this with `driver run map-route`. It makes one full round of live OSRM queries, so run it when roads are the point of the change.

Preconditions:

- Baseline state.
- `driver doctor` has no `WARN` for OSRM or the Leaflet CDN.

- **Default view.** Load `/`. `#info .lead` reads `從左側點選任一景點`, `.day-pin` count equals the day count, and a pin titled `DAY 2 <that day's last stop in the list>` exists.
- **Stay link.** Open each day's pin popup (`PINS[i].openPopup()`) and read the `住宿` href. It is `www.booking.com` with `checkin` on that day, a later `checkout`, `group_adults` and `nflt=price=TWD-…`, centred on the day's last stop.
- **Roads.** Wait until `LINES.gap0` has more than two points.
- **Cache.** Wait for `ROADS_KEY` in `localStorage` to have entries, then reload. No request goes to the OSRM host.
- **Fuel line.** Open a spot past Day 2. `.leaflet-popup-content .pop-fuel` matches `距上一站 … 油費$`.
- **Lines.** Choose `#btnRoute`. Dashed paths in `.leaflet-overlay-pane` go to zero and `.day-pin` stays. Choose it again to restore them.
- **Tiles.** Choose `[data-t="k"]`, `[data-t="p"]` and `[data-t="m"]`. `#route img.leaflet-tile` hosts become `arcgisonline`, `opentopomap` and `tile.openstreetmap.org`. `#route` has class `dim` except on `k`.
- **OSRM dead.** New page with the OSRM host blocked. `LINES.gap0` stays at two points and the pins still draw.
- **F road.** New page with OSRM stubbed to return `ref: "F208"`. A spot popup's `.pop-fuel` contains `路線僅供參考` and no `OSRM` or road number.
- **Leaflet dead.** New page with the CDN blocked. `.map-ph span` says `連不上`, and the day list renders.

## Gotchas

- The roads cache is written only at the end of a full round. A reload before that refetches everything.
- A stubbed F-road run proves the flag wiring, not whether the current itinerary touches an `F` road. On a live run, read `LEG_KM` for entries with `f: true`. When one exists, `docs/map.md` describes the fix.
- `fitBounds` animates. Wait for it to finish before clicking by pixel.
