# Spot detail

Selecting a spot from the list or the map pans the map to it and fills the right panel with its description, decision facts and live Wikimedia photos. On a phone the panel is a bottom sheet.

## Sub-features

- `spot-select` fills the panel, the stage handle, the active row and the map popup.
- `spot-photos` loads photos from Wikimedia at view time.
- `spot-photos-fail` shows a failure message with an image-search link.
- `spot-lightbox` opens, steps and closes, and returns focus to the photo.
- `spot-pin` selects a spot by clicking its map pin.
- `spot-mobile` collapses and expands the bottom sheet at phone width.

## How to get to it (user POV)

- Choose a spot in the day list.
- Choose a numbered pin or a small circle on the map.
- Choose a photo to enlarge it.

## Driving it with driver.mjs

Run all of this with `driver run spot-detail`.

Preconditions:

- Baseline state.
- `driver doctor` has no `WARN` for Commons or Wikipedia.

- **Select.** Open a spot with `openSpot`. `#info h2`, `#info .i-zh` and `#stageCur` match it, its `.spot` row has class `active`, `.badge.seq` matches `全程第 N／M`, `.pop-h` names it, and `.i-gmap` links to Google Maps.
- **Photos.** Open spots in order until `#gal .shot` appears. At least one `img` loads with a non-zero `naturalWidth` from a Wikimedia host.
- **Lightbox.** Choose the first `.shot`. `#lb` has class `on`. `#lbNext` changes `#lbCap` when there is more than one photo. `Escape` closes it and focus returns to the photo.
- **Pin.** Choose `全覽`, wait for the fit animation, and choose `.leaflet-marker-icon[title="DAY <n> <last stop>"]`. `#info h2` shows that stop.
- **Back.** Choose `#btnAll`. `#info h2` reads `全程路線` and no `.spot.active` remains.
- **Photos fail.** New page with `en.wikipedia.org` and `commons.wikimedia.org` blocked. `#gal .gal-msg b` reads `照片載入失敗` and its link goes to Google Images.
- **Phone.** New 390×844 page. Open a spot, then choose `#collapseBtn` twice. `body` gains `stage-collapsed` and `#collapseLabel` reads `展開`, then `收合`. The page has no horizontal scroll.

## Gotchas

- Some spots legitimately have no photos. `#gal .gal-msg` then reads `找不到這個地點的照片`, which is not a failure. Do not assert photos on one hard-coded spot.
- `#gal .skel` marks a gallery still loading. Wait for it to go away before counting `.shot`.
- An uncaught page error fails the journey even when every step passes. A photo error handler must not read `lbImg` after `closeLb` has nulled it. If `report.json` `pageErrors` points at `renderLb`, that is a product bug, so do not filter it out.
- A pin click keeps the current view and opens the popup. A list click pans the map as well.
