# Flights page

The flights page shows the confirmed flights, with the earlier price comparison kept in a collapsed archive. It has its own styles and script, and links back to the map.

## Sub-features

- `flights-nav` links from the itinerary and back.
- `flights-confirmed` shows the confirmed legs.
- `flights-archive` keeps the comparison closed until opened.
- `flights-groups` switches between two plan groups, with cards that match the count in each label.

## How to get to it (user POV)

- Choose `機票方案` in the banner at the top of the itinerary list.
- Open `訂票前的比價紀錄`, then choose a plan group.

## Driving it with driver.mjs

Run all of this with `driver run flights`.

Preconditions:

- Baseline state.

- **Open.** On `/`, choose `a.intro`. `h1` reads `冰島機票方案`, `.cf-legs` is visible, and `#cards` is hidden.
- **Archive.** Choose `details.archive > summary`. `#btnNew` is pressed and `#cards > li` count equals the `（N 組）` in its label.
- **Switch.** Choose `#btnOld`. The pressed state moves, the card count equals its label, and `.book-btn.primary` links to Google Flights.
- **Back.** Choose `a.nav-link`. The path is `/` and `#dayList` renders.

## Gotchas

- The Worker redirects `*.html` to the extensionless path, so `/flights.html` lands on `/flights`. Assert the path prefix. A plain static file server would not do this.
- The two pages do not share a stylesheet, so a palette change needs a separate look at this one.
