# Garment asset optimization

The current renderer set was normalized before the R2 migration to the exact signal consumed by `GarmentComposite`: mask alpha or rounded Rec. 709 luminance. Dimensions, full-file SHA-256 values, byte sizes, and renderer signal hashes are now recorded in `scripts/garment-assets-r2-manifest.json`.

The production files are immutable and are not optimization inputs. To prepare a future complete version in a local directory outside Git, run:

```bash
GARMENT_ASSET_SOURCE_DIR="$PWD/asset-staging/garments" npm run assets:optimize
```

The command fails when the explicit source directory is missing. It only writes smaller, signal-equivalent candidates back to that local staging directory. Generate a candidate R2 manifest after both garment and flatlay staging sets are complete; the full command and versioning workflow are documented in `docs/infra/r2-public-garment-assets.md`.
