# Phase 5 R2 setup and operations

R2 stores bytes only. PostgreSQL `order_files` records remain authoritative for
ownership, visibility, upload state, scan state, and deletion state.

## Buckets and exposure

- Create a Standard bucket named `garmops-public-downloads`.
- Create a separate Standard bucket named `garmops-private-orders`.
- Keep `garmops-private-orders` private. Never enable an `r2.dev` URL or custom
  public domain for it.
- Attach `downloads.garmops.com` to `garmops-public-downloads`. Disable the
  public `r2.dev` URL after the custom domain has been verified.
- Create a least-privilege R2 API token limited to these two buckets. The
  private app routes require read/write access; the public migration requires
  write access to the public bucket.

Cloudflare dashboard authentication is required before running:

```sh
npx wrangler login
npx wrangler r2 bucket create garmops-public-downloads
npx wrangler r2 bucket create garmops-private-orders
```

Apply the exact private-bucket CORS policy for each environment:

```sh
npx wrangler r2 bucket cors set garmops-private-orders \
  --file cloudflare/r2-private-cors.development.json
npx wrangler r2 bucket cors list garmops-private-orders
```

Production must use a reviewed copy of
`cloudflare/r2-private-cors.production.example.json`. Add only deployed app
origins that should upload directly. Do not use wildcard origins or headers.

## Environment variables

Configure these as sensitive server variables:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_PUBLIC_BUCKET=garmops-public-downloads
R2_PRIVATE_BUCKET=garmops-private-orders
```

Configure the public custom-domain origin:

```dotenv
NEXT_PUBLIC_DOWNLOADS_BASE_URL=https://downloads.garmops.com
```

Keep `R2_PRIVATE_UPLOADS_ENABLED=false` until the database migration, CORS
policy, credentials, and end-to-end authorization tests have all passed. The
flag also requires accounts and the Supabase administrative key.

Verify the credential, private presigned lifecycle, CORS response, checksum,
attachment download, and temporary-object cleanup:

```sh
npm run r2:verify-private
```

Only after this passes should `R2_PRIVATE_UPLOADS_ENABLED=true` be set in the
intended environment. Enabling Development does not authorize enabling Preview
or Production.

## Public ZIP migration

The migration command is a dry run unless `--apply` is explicitly supplied:

```sh
npm run r2:migrate-public
npm run r2:migrate-public -- --apply
```

It hashes the two repository ZIPs, uses immutable one-year cache headers,
refuses to replace an existing object with different metadata, verifies each
upload with `HeadObject`, and prints the custom-domain URLs.

The legacy paths become temporary redirects only when
`NEXT_PUBLIC_DOWNLOADS_BASE_URL` is configured:

- `/downloads/Garmops-print_templates-1.0.zip`
- `/downloads/neck-label-templates.zip`

Do not remove the repository copies until both custom-domain URLs and both
legacy redirects have been tested on the production deployment. Rollback is to
unset `NEXT_PUBLIC_DOWNLOADS_BASE_URL` and redeploy; this restores the local
repository paths.

## Private-file safety and retention

- Upload object keys are generated in PostgreSQL from UUIDs. Client filenames
  never become object keys.
- PUT URLs expire after seven minutes; GET URLs expire after three minutes.
- Finalization uses R2 `HeadObject` and rejects size, type, metadata, or
  supplied SHA-256 mismatches.
- Browser uploads enter `manual_review`. Customers can download only `clean`
  or system `not_required` files. Staff review routes require the existing
  permission and AAL2 checks.
- SVG downloads are forced to `application/octet-stream` with
  `Content-Disposition: attachment`; archives and vectors are never rendered or
  unpacked by the app.
- DELETE soft-deletes metadata and writes an audit record. No Phase 5 route
  physically deletes private objects. Define a separately reviewed retention
  job before object removal, and retain approval, accounting, shipment, and QC
  evidence according to business policy.
