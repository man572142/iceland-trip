# Editing the itinerary

The trip's data is `DAYS` in `public/index.html`, clockwise (西 → 北 → 東 → 南). Each day holds its
`spots` in travel order.

## Steps

1. Read the 「已修正 · 別改回去」 callout in `public/review.html`. Each item is a
   settled decision; a change that reverses one needs the user's say-so.
2. Put the spot in its day's `spots`, and update that day's `title`, `note`, `km` and `drive`.
3. Sync the same change into `iceland_trip_itinerary.md` and the load table in `review.html`.
4. Update the place's `decision` in `tools/candidates.json`; adding a place not yet there means adding it with its sources ([edit-pipeline.md](edit-pipeline.md#the-candidate-pool)).
5. Run `node tools/check_itinerary.mjs` (first `npm ci --prefix tools`). No `✗` may remain.
6. In the spot's popup, check the 路線僅供參考 flag. If it shows, fix the leg as in [map.md](map.md#f-roads).
7. Run the `verify` skill.

Adding or removing a day also means changing `tools/check_itinerary.mjs`, which pins the
day count.

## Placing a spot

A spot belongs to the day whose path passes it. Compare its insertion cost between the
neighbouring stops (OSRM `table` distances). A stop past the day's last one in the travel
direction goes to the next morning.

A spot can change days, so day numbers and trip dates go in the day's `note`, not in spot text.
Day 15/16 and Kolaportið's weekend are fixed, so they may name theirs.

## Fields

A day has `n`, `title`, `date`, `note`, `km`, `drive` (net driving hours) and `spots[]`. `km`/`drive` equal the `review.html` load table, whose caption
defines how they are measured. It may also have `nearby`; see [Highlights and nearby](#highlights-and-nearby).

A spot needs these, which the checker enforces:

| Field | Value |
|---|---|
| `name`, `zh` | Name and Chinese name. |
| `lat`, `lng`, `z` | Position and map zoom (14–17 by how tight the location is). |
| `q` | Wikimedia search string. Plain city names collide, so qualify with country/region words. See [map.md](map.md#photos) for when it applies. |
| `desc` | See [Writing a `desc`](#writing-a-desc). |
| `type` | A key of `TYPES`. Drives the list chip and the 「全程第 N／M 個」 counter that makes homogeneity visible. To add a key, add it to `TYPES`. Type by *experience*: a town you stop at for its pool is `bath`. |
| `dwell` | Minutes. Feeds the day's `budget` row (net driving + summed `dwell`, on a shared 12 h ruler). |

Optional ones render only where present. Add the decision fields (`walk` to `detour`) when the
surrounding day has them:

| Field | Meaning |
|---|---|
| `kind: "city"` | Transit hub or town, styled differently. |
| `wd` | Wikidata Q-id. Set on spots added from the map; ties the spot to its `places.json` entry. |
| `walk` | Walking distance and terrain. |
| `fee` | Prices. |
| `book` | Reservations. Its presence marks the spot 待決定. |
| `fixed: true` | Settled by the group. Keeps the 需預約 chip but leaves 待決定, so when a decision lands, set `fixed` and keep `book`. |
| `may` | Opening status in early May. |
| `detour` | Extra distance and road condition of a side road（來回 54 km、礫石路）. |
| `via` | Road pins. See [map.md](map.md#f-roads). |
| `highlights` | Things to see inside the stop. See [Highlights and nearby](#highlights-and-nearby). |

The 「只看待決定」 filter is `book` minus `fixed`.

## Highlights and nearby

A highlight is inside a stop. A `nearby` place is deliberately left out of the plan, with its
reason. There is no optional tier: a place is either a spot or in `nearby`. Both are optional and capped by the checker, because the page must stay restrained.

| Field | Item | Shown |
|---|---|---|
| Spot `highlights` | `{t, d, min}`: name, one short sentence, optional minutes | Spot panel only |
| Day `nearby` | `{name, zh, wd, lat, lng, type, why}` | A collapsed row at the end of the day; each item opens the candidate panel |

`why` is one short sentence stating the fact that explains the omission（「從米湖經 Húsavík 來回約
3.6 小時，所以沒排」）. A place in `nearby` must not also be a spot, and appears in only one day's
`nearby`; the checker enforces both.

## Writing a day `note`

Two parts, at most 4 lines in the day list at desktop width (about 110 characters):

1. **How the day starts and the first drive**: from the previous day's last stop to this day's
   first stop, with time and distance from OSRM（「從雷克雅維克出發，約 2 小時（122 公里）到第一站
   Hraunfossar」）. That is the day's departure drive. Name its start as a stop,
   never as where the night is spent ([Lodging](#lodging)). Round time to 5 minutes under an hour,
   to the quarter hour above it. Day 1 starts from KEF.
2. **What the day is about**: its character and highlights（冰河潟湖日、冰川日、全程車程最長的一天）,
   plus a choice that spans several stops（「全去排不下，要取捨」）or a time that sets the day's pace
   （「08:00 出發才趕得上 14:45 那團」）.

Leave out the stop order and a stop-by-stop list (the spot list shows them), the day's total km
(the header shows it), the longest leg unless it is what the day is about, pointers to other
days, and anything a spot field already holds: opening hours, closures and road status in
`may`／`detour`, reservations in `book`, walking times in `dwell`／`walk`.

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

The trip never assumes where a night is spent, because the group picks lodging itself: no
overnight towns in titles or notes, and `km`/`drive` count the day's path plus half of each
adjacent departure drive. The day's last-stop popup links to a live search around it
([map.md](map.md#stay-links)).
