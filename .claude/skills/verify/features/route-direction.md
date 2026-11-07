# Route direction

The trip can run clockwise or counter-clockwise over the same spots. Switching rebuilds the list and the map, returns the right panel to the overview, and is remembered on the next visit.

## Sub-features

- `dir-default` starts a new visitor on clockwise.
- `dir-switch` rebuilds the list, region text, pins and overview.
- `dir-mirror` makes clockwise day d the reverse of counter-clockwise day 16-d, with Day 1, 15 and 16 shared.
- `dir-persist` restores the choice after a reload.

## How to get to it (user POV)

- Choose `順時針` or `逆時針` under the page title.

## Driving it with driver.mjs

Run all of this with `driver run route-direction`.

Preconditions:

- Baseline state.

- **Default.** Load `/`. `.dir-switch button[data-dir="cw"]` has `aria-pressed="true"`, `#region` starts with `西部半島`, and a pin titled `DAY 2 <that day's last stop>` exists.
- **Switch.** Open a spot, then choose `[data-dir="ccw"]`. `#region` starts with `南岸`, `#info h2` reads `全程路線`, and `.i-zh` names 逆時針. `localStorage` key `DIR_KEY` holds `ccw`.
- **Mirror.** Compare the two lists with `listNames`. Shared days are equal and the others are reversed. The Day 2 pin title follows the new order, and `.day-pin` count equals the day count.
- **Persist.** Reload. `ccw` is still pressed and the list is unchanged.
- **Back.** Choose `[data-dir="cw"]`. The list equals the first load and storage holds `cw`.

## Gotchas

- Day boundaries are shared, so a mirror failure usually means `DAYS_CW` lost its `rev(n)` form. `node tools/check_itinerary.mjs` checks that too.
- `km`, `drive`, `title` and `note` belong to each direction and are not mirrored. Compare spots only.
