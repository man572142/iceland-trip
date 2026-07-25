# iceland-trip

冰島 10 天行程 · 互動地圖 — a single-page, self-contained itinerary map.

[點此前往](https://iceland-trip.man572142.workers.dev/)

- `public/index.html` — the site (no build step, no dependencies)
- `iceland_trip_itinerary.md` — the written plan (source notes, not deployed)

## Deployment

Hosted on Cloudflare Workers as a **static-assets-only Worker**: there is no
Worker script, just the contents of `public/` served directly. Pushes to `main`
build and deploy automatically.

All config lives in [`wrangler.jsonc`](wrangler.jsonc). The `assets.directory`
key is what makes this work — without it, `wrangler deploy` fails with
"Missing entry-point to Worker script or to assets directory", because a Worker
needs *either* a script (`main`) or an assets directory, and this project has
only the latter.

Note this is Workers, not Pages. Pages is the older static-hosting product and
uses a different key (`pages_build_output_dir`) that Workers ignores.

### Local preview

```sh
npx wrangler dev
```

### Manual deploy

Not normally needed, since pushing to `main` deploys:

```sh
npx wrangler deploy
```

## Notes

The map fetches photos from the Wikimedia Commons API (`commons.wikimedia.org`)
at runtime, so the page needs network access to render thumbnails. No API key.
