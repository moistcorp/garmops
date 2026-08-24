# Public garment assets on Cloudflare R2

Garmops garment renderer layers, sample SVGs, and product flatlays are public static assets stored separately from the frontend deployment.

## Production configuration

- Bucket: `garmops-public-assets`
- Custom domain: `https://assets.garmops.com`
- Current immutable version: `v5`
- Keys: `garments/v5/<existing-relative-path>` and `flatlays/v5/<existing-relative-path>`
- CORS: anonymous `GET` and `HEAD` from `*`, with no credentials or write methods
- Cache metadata: `public, max-age=31536000, immutable`
- Alternate `r2.dev` public access: disabled
- Frontend override: `NEXT_PUBLIC_ASSET_CDN_URL` (public and non-secret)

Wildcard read CORS is intentional because the public layers are read by Canvas from production, localhost, and preview deployments. `GarmentComposite` and `ArtworkMaterialCanvas` set `crossOrigin = "anonymous"` before assigning `src`, allowing their `getImageData()` calls to read pixels without tainting the Canvas.

The existing `garmops-private-orders` bucket is a different system. Never connect a public domain to it, make it public, replace its upload CORS rules, or place customer artwork in this public bucket.

## Verification

`scripts/garment-assets-r2-manifest.json` is the committed audit record for all 106 `v5` objects. It includes keys, sizes, full-file SHA-256 values, MIME types, dimensions, and renderer signal hashes where applicable. Version `v5` adds the new high-resolution oversized hoodie renderer set while preserving the verified `v4` bytes for every unchanged asset.

Run the complete remote check with:

```bash
npm run assets:verify
```

The verifier downloads every object through the configured custom domain and checks inventory totals, bytes, SHA-256, dimensions, renderer signals, MIME metadata, immutable caching, and anonymous `GET`/`HEAD` CORS. It also fails if assets are reintroduced under the legacy `public/garments` or `public/flatlays` directories.

## Publishing a future version

1. Prepare the complete garment and flatlay sets outside Git, conventionally under the ignored `asset-staging/` directory.
2. Optimize renderer layers locally:

   ```bash
   GARMENT_ASSET_SOURCE_DIR="$PWD/asset-staging/garments" npm run assets:optimize
   ```

3. Generate a candidate manifest with an explicit new version and output file:

   ```bash
   GARMENT_ASSET_SOURCE_DIR="$PWD/asset-staging/garments" \
   FLATLAY_ASSET_SOURCE_DIR="$PWD/asset-staging/flatlays" \
   ASSET_VERSION=v6 \
   ASSET_ORIGIN=https://assets.garmops.com \
   R2_BUCKET_NAME=garmops-public-assets \
   ASSET_MANIFEST_OUTPUT="$PWD/asset-staging/garment-assets-r2-manifest-v6.json" \
   node scripts/generate-r2-asset-manifest.mjs
   ```

4. Upload every file under new `garments/v6/` and `flatlays/v6/` keys with its manifest MIME type and `Cache-Control: public, max-age=31536000, immutable`.
5. Download and verify every new object before changing application code. Do not use ETag as a SHA-256 substitute.
6. Replace the committed manifest and change `PUBLIC_ASSET_VERSION` once in `src/lib/publicAssets.ts` from `v5` to `v6`.
7. Run unit, build, asset, and configurator Playwright checks, then deploy.
8. Keep `v5` available for rollback. Delete an old version only as a separate, explicit cleanup after the new version is established.

Never overwrite an immutable version key. The repository contains no Cloudflare credentials; Wrangler or another S3-compatible upload tool must use ephemeral/authenticated local credentials.

## Rollback

For a frontend rollback, restore the previous manifest and `PUBLIC_ASSET_VERSION`, then deploy. The preceding R2 version remains available, so no object rewrite is required. A full Git revert of the migration also restores the former local files and paths while the new bucket remains harmlessly in place.

Infrastructure can be rolled back independently by disabling the `assets.garmops.com` R2 custom domain. Do not delete the bucket or any asset version as part of an urgent code rollback, and never modify unrelated DNS, the private upload bucket, or its CORS policy.
