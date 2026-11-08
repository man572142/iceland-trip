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
and the spot lands in the cheapest slot (`bestSlot`), counting the previous day's last stop and
the next day's first. The place whose panel is open is drawn whatever `MIN_SL` says.

A day's `nearby` items ([itinerary.md](itinerary.md#highlights-and-nearby)) enter the same pool in
`loadPlaces()`, using their `places.json` entry when `wd` has one and their own fields otherwise.
An item with no entry gets no grey dot of its own. Once a draft plans the place, it leaves
「附近還有」.

## The candidate pool

`tools/candidates.json` records how the plan was chosen. The site never reads it; `public/places.json` above is a separate thing.

The method, region by region:

1. Collect candidates from external sources and keep each source's URL. The bar for a classic is being named by several independent sources.
2. Filter by the owner's exclusions and by early-May access, and keep where each May fact came from.
3. Give every candidate with two or more sources a `decision`:
   - `{kind:"plan", spot}`: the exact spot name, also when the place is a highlight inside that spot.
   - `{kind:"nearby", day}`: that day's `nearby` holds it.
   - `{kind:"skip", why}`: one sentence stating the fact that keeps it out.
   - `{kind:"excluded"}`: ruled out by the owner, with the reason in `excluded`.

`check_itinerary.mjs` guards this. Its constants hold the thresholds. It fails on a multi-source candidate with no decision, an excluded candidate in the plan, a second bath, or a required `fauna` with no planned candidate. It prints the scenery, animal and culture shares and warns when a day repeats a type.

Those are rule failures: the plan itself is wrong, so they stop every path, 更新行程 included. A stale decision is different: the plan moved and the pool has not caught up. `--stale-ok` turns it into a warning for the workflow, `apply_edits.mjs` lists it in the issue report, and the plain check keeps failing until a manual edit resolves it.

## The draft

Changes are `EDITS` (`[key, day]`, 0 = removed; key = spot name, or Q-id for added places) in
`localStorage` under `EDITS_KEY`. `applyEdits()` replays them on `BASE_SPOTS`, so an edit that
already matches the deployed data drops itself. Change `EDITS_KEY` whenever a stored draft's day
numbers would mean something else, so an old draft is never replayed under the new meaning.

km/drive move by the OSRM difference (the day's path in full, the two adjacent departure drives half each),
not a full recompute. Until deployed, the page keeps old km/drive on touched days and shows 已修改.

## The issue

更新行程 lists the changes and opens a prefilled GitHub new-issue URL (readable list + JSON, via
the clipboard above `ISSUE_MAX`). The JSON is `{v:2, days:{N:[keys…]}, add:{Qid:{…}}}`: the full
final order of every touched day, so the workflow reproduces the page's order exactly and refuses
an issue whose keys no longer match `main`. `apply_edits.mjs` accepts only the current `v`.

A spot added this way lands with `desc:""` (the page shows the Wikipedia intro), `zh` = name and a
per-type default `dwell` until `polish` writes them. `apply_edits.mjs` also drops it from any day's
`nearby`, since the checker refuses a `nearby` place that is in the plan.

## The workflow

`.github/workflows/itinerary-update.yml` runs on an issue titled `[行程更新]…` opened by the repo
owner.

- **`apply`** (no AI) runs `tools/apply_edits.mjs` and `tools/check_itinerary.mjs --stale-ok`, pushes to
  `main` and comments a report. A rule failure comments its reason and pushes nothing.
- **`polish`** runs only when that report lists text to write (new-spot `desc`, a title/note naming
  a moved or removed spot): `anthropics/claude-code-action` fills it and pushes again. It needs the
  repo secret `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`; without one it comments and stops.

`tools/` is not deployed. `itinerary.mjs` parses the data in `index.html` with acorn and keeps source
ranges, so `apply_edits.mjs` replaces only the touched `spots` arrays and `km`/`drive` values and
leaves every other byte. `check_itinerary.mjs` is the gate both jobs must pass.
