# Itinerary list

The left column lists every day and spot. A user expands days to read notes and the daily budget, filters to undecided spots, and searches to find out whether a place is already in the plan.

## Sub-features

- `list-render` shows every day and spot from the active route, with a header count.
- `list-expand` opens one day, or all days with `#toggleAll`.
- `list-todo` narrows the list to `book` spots that are not `fixed`.
- `list-search` matches planned spots by name, Chinese name or description.
- `list-search-pool` also finds unplanned candidates and opens them.
- `list-search-empty` shows a no-results state.

## How to get to it (user POV)

- Open `/`. The list is the left column at desktop width and the top of the page at phone width.
- Choose a day header, `全部展開`, or `只看待決定`.
- Type in the `搜尋景點是否已排入行程…` box.

## Driving it with driver.mjs

Run all of this with `driver run itinerary-list`.

Preconditions:

- Baseline state.

- **Render.** Load `/`. `#dayList > li.day` matches `DAYS`, `#dayCount` reads `<days> 天 · <spots> 個地點`, and only Day 1 has `aria-expanded="true"`.
- **Expand.** Choose the second `.day-head`. Its `.day-note` and `.budget` become visible.
- **Toggle all.** Choose `#toggleAll` twice. Every day opens and `#toggleAllLabel` reads `全部收合`, then every day closes and it reads `全部展開`.
- **Undecided.** Choose `#onlyTodo`. It has `aria-pressed="true"`, `#dayCount` starts with `<n> 個待決定`, and the visible spot names are exactly the undecided ones.
- **Search hit.** Fill `#spotSearch` with a spot's `zh`. That spot is visible, `#dayCount` starts with `找到`, and `#spotSearchClear` appears.
- **Search miss.** Fill `zzzqqq`. `#noResults` reads `沒有符合的景點`.
- **Candidate.** Fill an unplanned place's name and choose `#poolHits [data-k="<Q-id>"]`. `#info h2` shows the place, with a `不在行程裡` badge.
- **Clear.** Choose `#spotSearchClear`. The input is empty, the full count returns, and `#poolHits` is hidden.

## Gotchas

- Candidates arrive after `places.json` loads. Wait for `placesReady` before searching for one.
- Search opens every matching day and leaves them open after clearing.
- `.spot-name` also holds badges. Read its first text node for the name, as `listNames` does.
