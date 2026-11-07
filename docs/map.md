# Map, routes, photos and night links

All of this lives in `public/index.html`.

## Direction

`DAYS` is whichever direction is active (`ROUTES[dir]`, remembered under `DIR_KEY`). The
順時針／逆時針 buttons call `switchRoute()`, which rebuilds the list, redraws the route and
returns the right panel to the overview. 「全程第 N／M 個」 counters follow the active order
(`indexTypes()`).

## Map

One Leaflet map (cdnjs with SRI), built on load and never replaced. Selecting a spot pans it
and opens that spot's popup, so the whole route stays on screen. If Leaflet never arrives, the
placeholder message stays. Google Maps appears only as outbound links.

The route lives here because a `maps/dir/` URL caps at 10 stops: one coloured polyline per day,
a dashed segment across each gap between days, a numbered pin at every day's last stop.

- Lines sit in their own layer group, so 「路線」 hides them and keeps the pins.
- 「全覽」 refits to the whole trip and puts the route summary in the right panel
  (`body.route-on`).
- The road/satellite/terrain buttons swap `TILES`. The dark look is a CSS filter on the tile
  pane, off for imagery.
- Layers added before the map has a view throw inside Leaflet, so `buildRoute` sets a view
  first and fits bounds last.

## Road geometry

From OSRM's public demo server (`router.project-osrm.org`: no key, no uptime guarantee).
Segments draw straight first and redraw as each query lands, so a slow or dead server leaves
straight lines. That fallback is the feature; keep it in place of any spinner.

Geometry and each leg's km/minutes are cached in `localStorage` (`ROADS_KEY`) per segment,
keyed by a hash of its coordinates, so editing `DAYS` refetches only moved segments and the two
directions share the rest. A switch mid-fetch bumps `routeGen`, which stops the old round
painting onto the new lines.

Per-leg km feeds the 「距上一站 … 油費$」 line in each popup (`fuelLine`; deliberately rough
constants above `LINES`). Legs that hit an `F`-road are tagged 「路線僅供參考」.

## F-roads

OSRM routes by distance, not season, and will send you over an `F`-road: a highland track,
4x4-only and usually shut until June, which is after this trip. So its numbers are
shortest-path, not plans. Every query asks for `steps` purely to read each step's `ref`; any
`F`-prefixed one is named in the amber `#routeWarn`. Keep that warning wired to anything that
shows an OSRM duration. Its text is for travellers, so it speaks without "OSRM" or road numbers.

When it fires:

1. Check the coordinate of the stop that ends the leg. A stop off the road network snaps to the
   nearest road, possibly an `F`-road, and no pin can fix that.
2. Otherwise add `via:[[lat,lng],…]` (counter-clockwise) or `viaR` (clockwise) to that stop. The
   points are inserted before it in the query (`segments()`, `ROUTES[dir].viaKey`), pinning the
   line to the paved road.

## Photos

Fetched live at page view by `loadPhotos()`, never stored in the repo: the Wikimedia Commons API
(`origin=*` for CORS, no key) searched with the spot's `q`, falling back to a Wikipedia summary
thumbnail. Relevance is tuned through `q`.

## Night links

The overview gives each night the leg it falls on, with 住宿／加油／超市 links centred there.
住宿 goes to Booking.com, because a Google Maps search URL can't carry dates or party size:
`stayUrl()` fills check-in, check-out, coordinates and a price cap from `TRIP_YEAR`, `GUESTS` and
`STAY_MAX`. The last day has no night (red-eye flight) and falls back to Google, as 加油／超市
always do.
