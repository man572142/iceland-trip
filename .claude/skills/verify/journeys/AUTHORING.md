# Writing a journey

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

Rules:

- Act through the UI: `click`, `fill`, `selectOption`, mouse. Use `page.evaluate` only to read. `DAYS`, `DAYS_CCW`, `POOL`, `rmap` and similar are readable because they are top-level script bindings. Calling `select()`, `setDay()` or `switchRoute()` proves nothing, because it skips the path the user takes.
- Read trip content from the page with the helpers in `lib.mjs`. The itinerary changes often, so spot names and counts stay out of a journey.
- Use the stable handles: element ids, `data-dir`, `data-t`, `data-k`, `data-undo`, ARIA state, and UI labels.
