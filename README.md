# iceland-trip

冰島 10 天行程 · 互動地圖 — a single-page, self-contained itinerary map.

- `public/index.html` — the site (no build step, no dependencies)
- `iceland_trip_itinerary.md` — the written plan (source notes, not deployed)

## Deployment

Hosted on Cloudflare Pages, deployed from this repo. Pushes to `main` publish to
production; pushes to any other branch get a preview URL.

Build settings live in [`wrangler.jsonc`](wrangler.jsonc) — Pages reads
`pages_build_output_dir` from there, so there is nothing to configure in the
dashboard beyond the initial Git connection.

### One-time setup

Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git** → `man572142/iceland-trip`, then:

| Setting           | Value     |
| ----------------- | --------- |
| Framework preset  | None      |
| Build command     | *(empty)* |
| Build output dir  | `public`  |
| Root directory    | `/`       |
| Production branch | `main`    |

### Local preview

```sh
npx wrangler pages dev public
```

### Manual deploy

Not normally needed, but bypasses Git if you want to push a build directly:

```sh
npx wrangler pages deploy public
```

## Notes

The map fetches photos from the Wikimedia Commons API (`commons.wikimedia.org`)
at runtime, so the page needs network access to render thumbnails. No API key.
