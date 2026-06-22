# Tile images

Drop hex-tile art here (PNG/SVG/JPG — e.g. Midjourney exports) and map it in
`src/data/tiles.ts`. Each map key is resolved most-specific → least-specific:

```
'{districtId}/{kind}/{condition}'   e.g. 'd1/generic/pristine'
'{kind}/{condition}'                e.g. 'generic/ruin'
'{kind}'                            e.g. 'landmark'
```

- `kind`: `generic` | `landmark` | `feature`
- `condition`: `pristine` | `worn` | `crumbling` | `onfire` | `ruin`
- The path is relative to this folder's parent (`public/`), e.g. `tiles/house_ruin.png`.

Any tile without a mapping renders as a flat colored hex, so you can add art
incrementally. Images are clipped to the hex shape (`xMidYMid slice`).

Then run `npm run build` to refresh `public/app.js`.
