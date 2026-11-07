---
name: verify
description: Drive the Iceland trip site (static pages on a local Wrangler Worker) in real Chromium and capture proof. Use before reporting any change to public/index.html, public/flights.html or public/places.json as done, and whenever asked to run, check or screenshot the site.
---

# Verify the Iceland trip site

The site is static HTML with no backend. All state a user creates sits in the browser's `localStorage`. External services draw the map, roads and photos. The driver serves the checkout through the real Worker config and runs scripted journeys in Playwright Chromium.

Run every command from the repo root. In this file, `driver` means `node .claude/skills/verify/driver.mjs`.

## Launch

First use in a checkout, or after `package-lock.json` changes:

```bash
node .claude/skills/verify/driver.mjs setup
```

Start the server:

```bash
node .claude/skills/verify/driver.mjs up
```

It prints `READY http://127.0.0.1:<port>  run=<id>` when the served `index.html` is byte-identical to `public/index.html`. There is no seed step and no data directory. Each journey starts from an empty browser context.

- The port is the first free one from 8799. It never touches the editor preview on 8788 from `.claude/launch.json`.
- `up` refuses when this checkout already has a live instance. Drive that one, or run `down` first.
- Another worktree gets its own state and its own port, so instances run side by side.

Teardown is `driver down`.

## Doctor

Run this first, and again whenever anything looks wrong:

```bash
node .claude/skills/verify/driver.mjs doctor
```

It changes nothing. `FAIL` means do not drive: the process died, the served page differs from disk, `public/_headers` is not applied, Chromium is missing, or the page does not render with external traffic blocked. Exit code is non-zero on any `FAIL`.

`WARN` means an external service is unreachable. The instance is fine, but the journey named beside the service will fail for that reason. Report it as the external outage. Do not call it a regression.

## Drive

```bash
node .claude/skills/verify/driver.mjs run <journey>
```

`<journey>` is a feature name from [features/README.md](features/README.md), or `all`. Exit code `0` means every check passed and the page threw no uncaught error.

For a behaviour no journey covers, write an ad-hoc journey in your scratch directory and run it by path. Add it to `journeys/` and the feature map if it stays useful.

```bash
node .claude/skills/verify/driver.mjs run path/to/probe.mjs
```

A journey exports a default async function that receives `t`:

```js
import {openSpot, readDays, pickSpot, listNames} from '<repo>/.claude/skills/verify/journeys/lib.mjs';

export default async function(t){
  const page = await t.newPage({block:['router.project-osrm.org']});
  await t.open('/');
  await t.step('what the user does', async () => {
    await page.locator('#onlyTodo').click();
    t.eq(await page.locator('#onlyTodo').getAttribute('aria-pressed'), 'true', 'pressed');
    t.check(await page.locator('#dayCount').isVisible(), 'count visible');
  });
}
```

| `t` member | Use |
|---|---|
| `t.newPage({viewport, block, fulfill})` | New context with empty `localStorage`. `block` aborts the listed hosts. `fulfill` maps a host to a function that returns a Playwright fulfill response. |
| `t.open(path)` | Navigate on the local instance. |
| `t.step(title, fn)` | Run one user action. Saves a screenshot and an ARIA snapshot afterwards. A throw stops the journey. |
| `t.check(ok, msg, detail)`, `t.eq(actual, expected, msg)` | Record an assertion. A failure does not stop the step. |
| `t.requests` | Every URL requested so far. |

Rules for journeys:

- Act through the UI: `click`, `fill`, `selectOption`, mouse. Use `page.evaluate` only to read. `DAYS`, `DAYS_CCW`, `POOL`, `rmap` and similar are readable because they are top-level script bindings. Never call `select()`, `setDay()` or `switchRoute()` as proof, because that skips the path the user takes.
- Read trip content from the page with the helpers in `journeys/lib.mjs`. The itinerary changes often, so spot names and counts do not belong in a journey.
- Use the stable handles: element ids, `data-dir`, `data-t`, `data-k`, `data-undo`, ARIA state, and UI labels.
- The driver blocks `github.com` in every context. Read the `href` of `#sendIssue`. Never open it for real: an issue from the owner runs a workflow that pushes to `main`.

## Evidence

Every run writes to `.claude/skills/verify/evidence/<run-id>/<journey>/`, which git ignores:

- `NN.png` and `NN.aria.txt` for each step
- `report.json` with checks, page errors, console errors, 4xx/5xx responses, request counts per external host, and blocked URLs
- `wrangler.log` one level up, copied at `down`

Proof standards:

- Look at the screenshot of the step that matters, and read the actual DOM values. A passing exit code is not proof for a visual change.
- Prove side effects as well as the screen: `localStorage` for drafts, direction and roads, and the decoded issue URL for 更新行程.
- Stub only external services (OSRM, the Wikimedia APIs, the Leaflet CDN), and only for a state the live service will not produce on demand. Say in your report which steps were stubbed or blocked. `report.json` lists the blocked URLs.
- Editing `DAYS` needs one more check: `node tools/check_itinerary.mjs`.
- Report what could not be checked. External pages that links point to (Booking, Google Maps, GitHub) are verified only by URL.

## Cleanup

```bash
node .claude/skills/verify/driver.mjs down
```

It kills only the process tree this checkout started, using the pid in `.run/state.json`, and confirms the port closed. It removes `.run/` and keeps `evidence/`. Delete old evidence directories by hand when they are no longer needed.

## Helpers

- `driver.mjs` is the only entry point: `setup`, `up`, `doctor`, `run <journey|path.mjs|all>`, `down`.
- `journeys/lib.mjs` holds the read helpers and `openSpot` for journeys.

Keep the map honest with `/maintain-verification-skill`.
