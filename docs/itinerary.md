# Editing the itinerary

The trip's data is `DAYS_CCW` and `DAYS_CW` in `public/index.html`.

## Steps

1. Read the 「已修正 · 別改回去」 callout at the top of `public/review.html`. Each item is a
   settled decision; a change that reverses one needs the user's say-so.
2. Put spots in `DAYS_CCW`; `DAYS_CW` follows through its mirror. Write `title`, `note`,
   `km` and `drive` in each direction separately.
3. Sync the same change into `iceland_trip_itinerary.md` (both directions) and the load
   table in `review.html` (clockwise day numbers).
4. Run `node tools/check_itinerary.mjs` (first `npm ci --prefix tools`). No `✗` may remain.
5. In 全覽, read `#routeWarn`. If it fires, fix the leg as in [map.md](map.md#f-roads).
6. Run the `verify` skill.

Adding or removing a day also means changing `tools/check_itinerary.mjs`, which pins the
day count and the mirror.

## Two directions, one set of spots

`DAYS_CCW` (南→東→北→西) holds every spot. `DAYS_CW` (西→北→東→南, the default) is its
**mirror**: clockwise day d is counter-clockwise day 16-d's spot objects reversed
(`rev(n)`), with Day 1/15/16 shared. Day boundaries therefore match in both, and a move
changes both.

Spot text must read the same in both directions: day numbers and trip dates go in the
day's `note`. Day 15/16 and Kolaportið's weekend are fixed in both, so they may name theirs.

## Placing a spot

A spot belongs to the day whose path passes it. Compare its insertion cost between the
neighbouring stops (OSRM `table` distances), judging in the counter-clockwise direction.
A stop beyond the night's town in the travel direction (Kolugljúfur, Bónus Hveragerði)
goes to the next morning.

## Fields

A day has `n`, `title`, `date`, `note`, `km`, `drive` (net driving hours, `null` on the
Reykjavík day) and `spots[]`. Clockwise `km`/`drive` equal the `review.html` load table, whose
caption defines how they are measured.

A spot needs these, which the checker enforces:

| Field | Value |
|---|---|
| `name`, `zh` | Name and Chinese name. |
| `lat`, `lng`, `z` | Position and map zoom (14–17 by how tight the location is). |
| `q` | Wikimedia search string. Plain city names collide, so qualify with country/region words. |
| `desc` | See [Writing a `desc`](#writing-a-desc). |
| `type` | A key of `TYPES`. Drives the list chip and the 「全程第 N／M 個」 counter that makes homogeneity visible. To add a key, add it to `TYPES`. Type by *experience*: a town you stop at for its pool is `bath`. |
| `dwell` | Minutes. Feeds the day's `budget` row (net driving + summed `dwell`, on a shared 12 h ruler). |

Optional ones render only where present. Add the decision fields (`walk` to `detour`) when the
surrounding day has them:

| Field | Meaning |
|---|---|
| `opt: true` | Side trip or optional activity. Counts as 待決定. |
| `kind: "city"` | Transit hub or town, styled differently. |
| `wd` | Wikidata Q-id. Set on spots added from the map; ties the spot to its `places.json` entry. |
| `walk` | Walking distance and terrain. |
| `fee` | Prices. |
| `book` | Reservations. Its presence marks the spot 待決定. |
| `fixed: true` | Settled by the group. Keeps the 需預約 chip but leaves 待決定, so when a decision lands, set `fixed` and keep `book`. |
| `may` | Opening status in early May. |
| `detour` | Extra distance and road condition of a side road（來回 54 km、礫石路）. |
| `via`, `viaR` | Road pins. See [map.md](map.md#f-roads). |

The 「只看待決定」 filter is `opt` or `book`, minus `fixed`.

## Writing a day `note`

Two parts, at most 4 lines in the day list at desktop width (about 110 characters):

1. **How the day starts and the first drive**: from where, how long, how far, to which stop.
  「從雷克雅維克出發，經過約 2.5 小時車程（160 公里）前往 Snæfellsnes 半島。」Start from the
  night's town when the previous note names one（Akureyri、米湖、Egilsstaðir、Höfn、Skaftafell、
  Vík、Hveragerði）, otherwise from the previous day's last stop. Take time and distance from
  OSRM; round time to 5 minutes under an hour, to the quarter hour above it.
2. **What the day is about**: the area's or the day's character and its highlights
  （冰川日、瀑布日、全程最長的移動日、刻意留白的半日）, and where the night falls.

Leave out the stop order and a stop-by-stop list (the spot list shows them), the day's total
km (the header shows it), and anything a spot field already holds: closures and road status
in `may`／`detour`, reservations in `book`, walking times in `dwell`／`walk`.

## Writing a `desc`

One paragraph: what the place is, then what you do or see there —「能繞到水簾正後方，從內側
回頭看水幕」, not「必看」. The group decides on facts, so state facts rather than scores or
rankings.

**One fact, one field:** times and distances in `dwell`／`walk`, prices in `fee`, reservations
in `book`, seasonal status in `may`. A tip that isn't a reservation (「旺季建議先訂位」) goes in
`desc`, since `book` would turn the spot 待決定.

**Every field reads on its own.** Cross-day arithmetic belongs in the budget row and `note`;
keep out "這天已 N h", pointers to other days or spots, and recommendations.

Prices and opening dates change yearly: hedge them（約、通常）and name the source to
re-check (road.is, ust.is, the operator's site).

## Lodging

`DAYS` names no lodging or overnight towns, because nothing here can tell whether a town is
bookable. Each night's overview row links to a live search around the leg it falls on instead
([map.md](map.md#night-links)).
