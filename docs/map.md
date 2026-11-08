# Map, routes, photos and stay links

All of this lives in `public/index.html`.

## Map

One Leaflet map (cdnjs with SRI), built on load and never replaced. Selecting a spot pans it
and opens that spot's popup, so the whole route stays on screen. If Leaflet never arrives, the
placeholder message stays. Google Maps appears only as outbound links.

The route lives here because a `maps/dir/` URL caps at 10 stops: one coloured polyline per day,
a dashed segment for each departure drive (previous day's last stop to this day's first stop, driven that morning, so in this day's colour), a numbered pin at every day's last stop.

- Lines sit in their own layer group, so 「路線」 hides them and keeps the pins.
- With no spot selected the right panel shows the empty prompt and the map fits the whole trip
  (`showHome`). There is no separate route-overview page.
- The road/satellite/terrain buttons swap `TILES`. The dark look is a CSS filter on the tile
  pane, off for imagery.
- Layers added before the map has a view throw inside Leaflet, so `buildRoute` sets a view
  first and fits bounds last.

## Road geometry

From OSRM's public demo server (`router.project-osrm.org`: no key, no uptime guarantee).
Segments draw straight first and redraw as each query lands, so a slow or dead server leaves
straight lines. That fallback is the feature; keep it in place of any spinner.

Geometry and each leg's km/minutes are cached in `localStorage` (`ROADS_KEY`) per segment,
keyed by a hash of its coordinates, so editing `DAYS` refetches only moved segments. A redraw
mid-fetch bumps `routeGen`, which stops the old round painting onto the new lines.

Per-leg km feeds the 「距上一站 … 油費$」 line in each popup (`fuelLine`; deliberately rough
constants above `LINES`). Legs that hit an `F`-road are tagged 「路線僅供參考」.

## F-roads

OSRM routes by distance, not season, and will send you over an `F`-road: a highland track,
4x4-only and usually shut until June, which is after this trip. So its numbers are
shortest-path, not plans. Every query asks for `steps` purely to read each step's `ref`; any
`F`-prefixed one marks the leg 路線僅供參考 in the popup (`LEG_KM.f`). Keep that flag wired to
anything that shows an OSRM duration. It reads only the prefix, so a highland road numbered without one (550 Kaldidalur) passes silently: read the `ref`s of a new leg yourself. Its text is for travellers, so it speaks without "OSRM" or road numbers.

When it fires:

1. Check the coordinate of the stop that ends the leg. A stop off the road network snaps to the
   nearest road, possibly an `F`-road, and no pin can fix that.
2. Otherwise add `via:[[lat,lng],…]` to that stop. The points are inserted before it in the query
   (`segments()`), pinning the line to the paved road. On a day's first stop they shape the dashed departure drive instead.

## Photos

Fetched live at page view by `loadPhotos()` from Wikimedia (no key), never stored in the repo.

1. **Nearby** (`nearbyPhotos()`): Commons files geotagged within 1 km of the spot's `lat`/`lng`,
   widened to 5 km under 4 results. Maps, drawings, paintings, pre-1990 photos and images under
   800 px are dropped; featured and quality images go first, the rest by distance; at most 2 per
   author, 6 in all. A wrong coordinate gives wrong photos.
2. **By name** (nothing nearby): the spot's Wikipedia article images, its lead image, then a
   Commons search with `q`. Relevance is tuned through `q`.

Above the photos, 更多照片 links to Google Images (name + Iceland) and Flickr's nearby search.
If every image fails to load, the gallery shows the no-photo message instead of an empty grid.

## Stay links

Every map popup carries 住宿／加油／超市 links centred on that spot; the day's last-stop pin is
the one to use for finding a bed.
住宿 goes to Booking.com, because a Google Maps search URL can't carry dates or party size:
`stayUrl()` fills check-in, check-out, coordinates and a price cap from `TRIP_YEAR`, `GUESTS` and
`STAY_MAX`. The last day has no night (red-eye flight) and falls back to Google, as 加油／超市
always do.
