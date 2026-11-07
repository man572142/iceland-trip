# Candidates, the draft and 更新行程

The site's map edits travel: candidate → local draft → GitHub issue → workflow → `main`.

## Candidates

`public/places.json` holds candidate places from Wikidata, generated rather than hand-edited:
`python3 tools/build_places.py` runs `tools/places.rq` against query.wikidata.org.

- Classes, their `type` key and minimum sitelink count: the `VALUES` in `tools/places.rq`.
- Wrong coordinates and dropped entries: `tools/place_fixes.json`.

An entry that matches no itinerary spot draws as a grey canvas dot under the route, thinning at
low zoom by sitelink count (`MIN_SL`), with labels at higher zoom. The matching rules are at
`loadPlaces()`. A spot removed from the plan becomes an amber ring. Clicking either opens the
same right panel as a spot (Wikipedia intro, zh-TW when a zh article exists, plus photos) with a
day picker; spots in the plan get 移到這天／從行程移除. Each option shows the straight-line detour,
and the spot lands in the cheapest slot (`bestSlot`), counting the previous night's last stop and
the next morning's first.

## The draft

Changes are `EDITS` (`[key, ccwDay]`, 0 = removed; key = spot name, or Q-id for added places) in
`localStorage` under `EDITS_KEY`. `applyEdits()` replays them on `BASE_SPOTS` and re-mirrors
`DAYS_CW`, so an edit that already matches the deployed data drops itself.

km/drive move by the OSRM difference (the day's path in full, the two overnight legs half each),
not a full recompute. Until deployed, the page keeps old km/drive on touched days and shows 已修改.

## The issue

更新行程 lists the changes and opens a prefilled GitHub new-issue URL (readable list + JSON, via
the clipboard above `ISSUE_MAX`). The JSON is `{v:1, days:{ccwN:[keys…]}, add:{Qid:{…}}}`: the full
final order of every touched day, so the workflow reproduces the page's order exactly and refuses
an issue whose keys no longer match `main`.

A spot added this way lands with `desc:""` (the page shows the Wikipedia intro), `zh` = name and a
per-type default `dwell` until `polish` writes them.

## The workflow

`.github/workflows/itinerary-update.yml` runs on an issue titled `[行程更新]…` opened by the repo
owner.

- **`apply`** (no AI) runs `tools/apply_edits.mjs` and `tools/check_itinerary.mjs`, pushes to `main`
  and comments a report.
- **`polish`** runs only when that report lists text to write (new-spot `desc`, a title/note naming
  a moved or removed spot): `anthropics/claude-code-action` fills it and pushes again. It needs the
  repo secret `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`; without one it comments and stops.

`tools/` is not deployed. `itinerary.mjs` parses the data in `index.html` with acorn and keeps source
ranges, so `apply_edits.mjs` replaces only the touched `spots` arrays and `km`/`drive` values and
leaves every other byte. `check_itinerary.mjs` is the gate both jobs must pass.
