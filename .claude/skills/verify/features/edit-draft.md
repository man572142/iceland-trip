# Edit draft

A user can add a candidate place to a day, move a spot, or remove one. Changes are a local draft replayed over the deployed plan. 更新行程 lists them and opens a prefilled GitHub issue that a workflow turns into a commit.

## Sub-features

- `draft-dot` opens a candidate by clicking its grey dot on the map.
- `draft-remove` removes a spot and shows it as removed.
- `draft-move` moves a spot to another day, with a `移入` badge.
- `draft-add` adds a candidate found by search, with a `新增` badge and a Wikipedia intro.
- `draft-persist` restores the draft after a reload.
- `draft-issue` lists the changes and builds an issue URL whose JSON matches the page.
- `draft-undo` undoes one change.
- `draft-drop` discards everything after a confirmation.

## How to get to it (user POV)

- Choose a grey dot or an amber ring on the map, or search for an unplanned place.
- In a spot's panel, use the `排在` day picker with `移到這天` or `從行程移除`. In a candidate's panel, use `加入這天`.
- Choose `更新行程` in the header.

## Driving it with driver.mjs

Run all of this with `driver run edit-draft`.

Preconditions:

- Baseline state.
- `driver doctor` has no `WARN` for Wikipedia.

- **Empty.** Load `/`. `#btnEdits` is disabled and `localStorage` key `EDITS_KEY` holds an empty list.
- **Dot.** Click the canvas at a candidate's pixel position. `#info .badge` reads `不在行程裡` and `#planGo` is enabled.
- **Remove.** Open a spot and choose `#planRm`. The badge reads `已從行程移除`, the spot leaves the list, `#editN` reads `1`, that day shows the `已修改` chip, and storage records day `0`.
- **Move.** Open a spot, `#planGo` is disabled, select another value in `#planDay`, and choose `#planGo`. The spot moves, `#editN` reads `2`, and its row has a `移入` badge.
- **Add.** Search a candidate and choose `#poolHits [data-k="<Q-id>"]`. `#sumDesc` fills in. Choose `#planGo`. `#editN` reads `3` and the row has a `新增` badge.
- **Persist.** Reload. `#editN` reads `3` and the list is unchanged.
- **Issue.** Choose `#btnEdits`. `#info h2` reads `更新行程`, and `.change-k` lists `移除`, `換天`, `新增`. Read the `#sendIssue` href without opening it. It targets `github.com/man572142/iceland-trip/issues/new`, its title starts with `[行程更新]`, and the body's JSON has `v:1`, the candidate in `add`, and `days` equal to the page's `DAYS_CCW` order.
- **Undo.** Choose the first `[data-undo]`. Two rows remain and the removed spot returns.
- **Drop.** Accept the dialog on `#dropEdits`. The list equals the baseline, `#btnEdits` is disabled, and storage is empty.

## Gotchas

- Never open `#sendIssue`. An issue from the repo owner runs the workflow that pushes to `main`. The driver blocks `github.com`, and `report.json` `blocked` must stay empty for this journey.
- Grey dots are on a canvas, so they have no DOM handle. Read a dot's pixel position from `rmap`, confirm `elementFromPoint` is the canvas and not a route line, and use the mouse.
- Added spots wait for `places.json`. After a reload, wait for `placesReady` before reading `#editN`.
- A day cannot lose its last spot. `#planRm` is disabled there, so pick spots from days with at least three.
- Dropping a draft opens a native `confirm`. Register the dialog handler before the click.
