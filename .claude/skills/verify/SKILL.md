---
name: verify
description: Drive the Iceland trip site in real Chromium through the local Worker and capture proof. Use before reporting any change to public/index.html, public/flights.html or public/places.json as done, and whenever asked to run, check or screenshot the site.
---

# Verify the Iceland trip site

All state a user creates sits in the browser's `localStorage`, and external services draw the map, roads and photos. Each journey starts from an empty browser context.

Run every command from the repo root. In this skill and its feature map, `driver` means `node .claude/skills/verify/driver.mjs`.

The work is done when every journey touching the change exits `0`, you have looked at the proof below, and your report names what was stubbed and what could not be checked.

## 1. Launch

First use in a checkout, or after `package-lock.json` changes:

```bash
node .claude/skills/verify/driver.mjs setup
```

Then start the server:

```bash
node .claude/skills/verify/driver.mjs up
```

It prints `READY http://127.0.0.1:<port>  run=<id>` when the served `index.html` is byte-identical to `public/index.html`.

- `up` refuses when this checkout already has a live instance. Drive that one, or run `down` first.
- Another worktree gets its own state and its own port, so instances run side by side. The driver's ports stay clear of the editor preview in `.claude/launch.json`.

## 2. Doctor

Run this after `up`, and again whenever anything looks wrong. It changes nothing:

```bash
node .claude/skills/verify/driver.mjs doctor
```

- `FAIL` means stop driving and fix it: the process died, the served page differs from disk, `public/_headers` is not applied, Chromium is missing, or the page does not render with external traffic blocked.
- `WARN` means an external service is unreachable. The instance is fine, and the journey named beside the service will fail for that reason. Report that as the external outage rather than a regression.

## 3. Drive

```bash
node .claude/skills/verify/driver.mjs run <journey>
```

`<journey>` is a feature name from [features/README.md](features/README.md), or `all`. Exit code `0` means every check passed and the page threw no uncaught error. For a behaviour no journey covers, write one: [journeys/AUTHORING.md](journeys/AUTHORING.md).

Only read the `href` of `#sendIssue`, in any browser. An issue from the owner runs a workflow that pushes to `main`. The driver blocks `github.com` in every context it opens.

## 4. Prove

Every run writes to `.claude/skills/verify/evidence/<run-id>/<journey>/`, which git ignores:

- `NN.png` and `NN.aria.txt` for each step
- `report.json` with checks, page errors, console errors, 4xx/5xx responses, request counts per external host, and blocked URLs
- `wrangler.log` one level up, copied at `down`

Proof standards:

- Look at the screenshot of the step that matters, and read the actual DOM values. A visual change needs more than a passing exit code.
- Prove side effects as well as the screen: `localStorage` for drafts and roads, and the decoded issue URL for 更新行程.
- Stub only external services (OSRM, the Wikimedia APIs, the Leaflet CDN), and only for a state the live service will not produce on demand. `report.json` lists the blocked URLs.
- Editing `DAYS` needs one more check: `node tools/check_itinerary.mjs`.
- External pages that links point to (Booking, Google Maps, GitHub) are verified only by URL.

## 5. Clean up

```bash
node .claude/skills/verify/driver.mjs down
```

It kills only the process tree this checkout started and confirms the port closed. It removes `.run/` and keeps `evidence/`; delete old evidence directories by hand when they are no longer needed.

Keep the map honest with `/maintain-verification-skill`.
