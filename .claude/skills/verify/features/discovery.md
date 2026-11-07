# Discovery

A spot can name what is worth seeing inside it, and a day can name places deliberately left out, with the reason. Both stay out of the default view: highlights show only in the spot panel, and a day's `nearby` is one collapsed row.

## Sub-features

- `discovery-row` shows a collapsed 附近還有 row at the end of a day that has `nearby`.
- `discovery-expand` reveals name, zh and `why`, by mouse or keyboard, inside the day accordion.
- `discovery-panel` opens an item in the candidate panel, with the Wikipedia intro, `why` and day picker, and pans the map so the panel does not cover it.
- `discovery-marker` draws the open item on the map even when `MIN_SL` thins it out.
- `discovery-draft` adds an item to the draft, removes it from the row, and builds the issue JSON.
- `discovery-highlights` shows highlights in the spot panel only.

## How to get to it (user POV)

- Open a day that has `nearby`, then choose 附近還有 N 處 at the end of its spots.
- Choose an item, then use `加入這天` in the panel.
- Choose a spot that has `highlights` and read the block under its description.

## Driving it with driver.mjs

Run all of this with `driver run discovery`.

Preconditions:

- Baseline state.
- `driver doctor` has no `WARN` for Wikipedia.
- The data holds at least one day with `nearby` and one spot with `highlights`. The journey reads them from `DAYS`.

- **Row.** Open the day. `.near-toggle` reads `附近還有 N 處` with `aria-expanded="false"`, its items are hidden, it is the last child of `.day-body-pad`, and it has no fill or border.
- **Expand.** Focus `.near-toggle` and press Enter. `aria-expanded` flips, `.near-item[data-k="<Q-id>"]` shows name, zh and `why`, and it sits inside `.day-body-inner` without clipping.
- **Panel.** Choose the item. `#info h2` names it, `.badge` reads `不在行程裡`, `.i-facts dd` holds `why`, `#sumDesc a.src` exists, `#planGo` is enabled, `rmap` has moved, `elementFromPoint` at the place's pixel is inside the map, and `.pop-h` names it.
- **Marker.** Zoom out with `.leaflet-control-zoom-out` until `MIN_SL` exceeds the place's `sl`. `placeLayer` still holds a layer at its position. Choose `#btnAll` and the layer goes.
- **Add.** Choose the item, select its day in `#planDay`, and choose `#planGo`. `#editN` reads `1`, storage holds `[[Q-id, day]]`, the item leaves the row, and the row goes with its last item. A reload keeps this.
- **Issue.** Choose `#btnEdits` and read the `#sendIssue` href without opening it. `add[Q-id]` carries the name, zh, coordinates and type, and `days` equals the page's order and holds the Q-id.
- **Undo.** Choose `[data-undo]`. The row returns and storage is empty.
- **Filters.** The row is hidden during search and 只看待決定.
- **Highlights.** `#dayList` text holds no highlight name. Open the spot. `#info .i-desc + .i-highs` has one `li` per highlight with its name and sentence.
- **Phone.** New 375×812 page. Run the row, expand, panel and highlights states. `document.documentElement.scrollWidth` and `.stage` stay within the viewport.

## Gotchas

- The panel's `zh` comes from the `nearby` item even when `places.json` has its own.
- `placeLayer` is a canvas, so a marker has no DOM handle. Read `placeLayer.getLayers()`.
- `buildList` rebuilds the list after every edit, which closes the days. Reopen the day before reading the row.
- A nearby item without a `places.json` entry cannot be produced from the live data. To check that path, run the journey in a temp copy of the repo with the entry removed from `public/places.json`.
