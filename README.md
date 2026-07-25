# iceland-trip

冰島 10 天行程 · 互動地圖 — a single-page, self-contained itinerary map.

- `public/index.html` — the site (no build step, no dependencies)
- `iceland_trip_itinerary.md` — the written plan (source notes, not deployed)

## Deployment

Hosted on Cloudflare Workers static assets, built from this repo by Workers
Builds. Pushes to `main` publish to production; pushes to any other branch get a
preview URL.

There is no build command and no Worker script — the build just runs
`wrangler deploy`, which uploads the `assets.directory` declared in
[`wrangler.jsonc`](wrangler.jsonc). Nothing to configure in the dashboard beyond
the initial Git connection.

> This is **not** a Pages project. If you ever move it to Pages, swap
> `assets.directory` back to `"pages_build_output_dir": "public"` — a Pages
> config makes `wrangler deploy` fail with
> `Missing entry-point to Worker script or to assets directory`, because Pages
> projects deploy via `wrangler pages deploy` instead.

### Local preview

```sh
npx wrangler dev
```

### Manual deploy

Not normally needed, but bypasses Git if you want to push a build directly:

```sh
npx wrangler deploy
```

## Notes

The map fetches photos from the Wikimedia Commons API (`commons.wikimedia.org`)
at runtime, so the page needs network access to render thumbnails. No API key.
