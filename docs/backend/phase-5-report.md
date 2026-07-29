# Phase 5 implementation report

Date: 2026-07-29
Scope: Cloudflare R2 public downloads, private presigned file lifecycle,
PostgreSQL authorization and metadata, legacy compatibility, CORS, and unsafe
content handling.

## Outcome

Phase 5 is implemented without changing any frontend component or page.

The public R2 rollout is live:

- `garmops-public-downloads` exists;
- `downloads.garmops.com` is active with valid SSL;
- public `r2.dev` access is disabled;
- both repository ZIPs are present under immutable, versioned keys;
- the custom-domain response type is `application/zip`;
- the custom-domain cache policy is
  `public, max-age=31536000, immutable`;
- downloaded SHA-256 values match the repository files byte-for-byte.

The private R2 boundary is provisioned and enabled in Vercel Development:

- `garmops-private-orders` exists and has no public URL;
- Development CORS allows only `http://localhost:3000` and
  `http://127.0.0.1:3000`;
- only `PUT` and `HEAD` plus the exact signed headers are allowed;
- the least-privilege credential is scoped to both reviewed buckets;
- local and Vercel-injected credential round trips passed;
- `R2_PRIVATE_UPLOADS_ENABLED=true` is restricted to Vercel Development;
- Preview and Production remain unchanged.

The additive database migration is applied to the linked
`garmops-development` Supabase project. Local and remote schema linting report
no errors.

## Public downloads and compatibility

Public keys:

- `templates/print/Garmops-print_templates-1.0.zip`;
- `templates/neck-label/neck-label-templates-1.0.zip`.

`src/config/publicDownloads.ts` centralizes these URLs and falls back to the
repository files while the custom-domain environment variable is absent.

`scripts/migrate-public-downloads-to-r2.ts`:

- defaults to a no-credential dry run;
- reads and hashes both repository ZIPs;
- prints size, SHA-256, object key, and custom-domain URL;
- applies explicit type and immutable cache metadata;
- refuses to replace a different immutable object;
- verifies an existing object by metadata or by downloading and hashing its
  body;
- verifies newly uploaded objects with `HeadObject`;
- is repeatable and never prints credentials.

The two public objects were uploaded through the authorized Wrangler session
with the same explicit content type and cache policy. The migration script was
then run with S3 credentials and idempotently verified both existing objects.
Custom-domain downloads were also hashed:

| Object | Bytes | SHA-256 |
| --- | ---: | --- |
| Print templates | 8,560,691 | `7bd89caf9c14c7d18e8462c02823cf4689ecc0e39e2e55fa97269f5995890be8` |
| Neck-label templates | 7,493,265 | `e7c16e5cce3ce6749a7c27a0a37dc3fd4bae8f1c4a5f19965e6f07c4babd5c50` |

The current production legacy paths still return those exact hashes.
Conditional temporary redirects are ready and are emitted only when
`NEXT_PUBLIC_DOWNLOADS_BASE_URL=https://downloads.garmops.com` is configured.
The repository ZIPs have intentionally not been removed. Removal is allowed
only after the redirect-bearing code is deployed and the production redirects
are verified.

## Private file routes

Node.js route handlers:

- `POST /api/uploads/create`;
- `POST /api/uploads/:fileId/finalize`;
- `POST /api/files/:fileId/download-url`;
- `POST /api/files/:fileId/review`;
- `DELETE /api/files/:fileId`.

Every route fails closed behind `R2_PRIVATE_UPLOADS_ENABLED`, uses verified
Supabase sessions, returns private/no-store responses, and requires the exact
configured application origin for state-changing requests.

Upload slots:

- accept exactly one order or design target;
- enforce the documented per-kind extension, MIME, and byte limits in both
  TypeScript and PostgreSQL;
- reject public visibility and unauthorized staff-only visibility;
- use a PostgreSQL-generated UUID and server-generated object key;
- never place a raw client filename in an object key;
- sign exact file ID and expected size metadata;
- optionally sign and later verify SHA-256;
- expire after seven minutes.

Finalization:

- reads the object with R2 `HeadObject`;
- verifies the private bucket, generated key, signed file ID, expected size,
  actual size, exact content type, ETag, and supplied checksum;
- requires the original uploader and tenant-visible metadata;
- uses a service-only RPC for the final transition;
- is idempotent for an already finalized browser upload;
- places browser uploads in `manual_review`.

Downloads:

- authorize through forced-RLS metadata on every request;
- never accept a client bucket or key;
- return only short-lived, three-minute GET URLs;
- hide rejected files;
- allow customers only `clean` or system `not_required` files;
- allow AAL2 staff to access reviewable files through the existing permission
  boundary;
- force `Content-Disposition: attachment`;
- override SVG responses to `application/octet-stream`;
- set private/no-store response controls.

DELETE performs an audited metadata soft delete only. No route physically
deletes private objects. Approval and invoice references block deletion at the
database boundary.

## Database lifecycle and authorization

Migration:

- `20260729154411_r2_file_foundation.sql`.

It adds:

- `file_upload_status`;
- pending, finalized, failed, and expired upload states;
- upload expiry and finalization timestamps;
- verified object ETag;
- scan reviewer, time, and note;
- exact-one-target and lifecycle constraints;
- pending-expiry and manual-review queue indexes;
- authorized upload-slot creation;
- service-only exact finalization;
- permission/AAL2-gated scan review;
- audited soft deletion;
- service-only abandoned-slot expiry.

Existing file inserts remain finalized by default, preserving Phase 2/3
compatibility. Browser sessions still have no direct file-table mutation
privileges.

The Phase 5 pgTAP suite verifies:

- wrong-organization slot creation is denied;
- wrong-organization metadata access and deletion are denied;
- type, size, visibility, and path-like filename validation;
- raw filenames cannot affect keys;
- mismatched finalization is rejected;
- service-only finalization and idempotency;
- customer self-review denial;
- staff AAL1 denial and AAL2 permission success;
- audit evidence;
- soft deletion;
- abandoned-slot expiry;
- legacy metadata defaults.

## Environment and CSP

The server environment now:

- requires Supabase and accounts before private R2 uploads can be enabled;
- accepts only the exact bucket names;
- requires the R2 S3 endpoint to match the configured account;
- rejects endpoint paths, credentials, query strings, and fragments;
- accepts only an HTTPS-origin public download base.

The application CSP adds only the configured exact R2 S3 origin to
`connect-src`; there is no wildcard R2 origin.

Vercel Development contains encrypted values for the R2 account, endpoint,
bucket names, access key ID, and secret access key. It also contains the
verified public download origin and the enabled private-upload flag. A second
private round trip using Vercel's injected environment passed.

## Validation

| Check | Result |
| --- | --- |
| Clean local database rebuild | Passed |
| Supabase pgTAP | Passed; 5 files, 319 assertions |
| Local Supabase schema lint | Passed; no errors |
| Hosted migration dry-run | Exactly one Phase 5 migration |
| Hosted migration apply | Passed |
| Hosted migration history | Local and remote versions match |
| Hosted Supabase schema lint | Passed; no errors |
| Generated database types | Passed |
| TypeScript | Passed |
| ESLint | Passed; no warnings |
| Vitest | Passed; 5 files, 23 tests |
| Next.js production build | Passed; all Phase 5 routes present |
| Public R2 domain and SSL | Active |
| Public/private `r2.dev` URLs | Disabled |
| Private Development CORS | Applied and verified |
| Public object headers | Passed |
| Public object SHA-256 | Passed for both ZIPs |
| Legacy production ZIP SHA-256 | Passed for both paths |
| Conditional legacy redirect config | Passed |
| Public migration S3 idempotency | Passed for both objects |
| Private presigned PUT and CORS | Passed locally and through Vercel Development |
| Private HEAD metadata/type/size/checksum | Passed |
| Private three-minute attachment GET | Passed; body hash exact |
| Temporary private object cleanup | Passed |
| Enabled route unauthenticated boundary | Passed; `401` |
| Enabled route wrong-origin boundary | Passed; `403` |
| Enabled Vercel Development build | Passed |

The first sandboxed build failed because Turbopack could not bind its internal
worker port. The approved unrestricted rerun passed; this was an execution
sandbox restriction, not an application failure.

## Rollout boundary

- Private R2 is enabled only in Vercel Development. Preview and Production
  remain off until a production origin, Production CORS, and production rollout
  are explicitly approved.
- Production CORS is provided as a reviewed example but is not applied to the
  Development bucket policy.
- `NEXT_PUBLIC_DOWNLOADS_BASE_URL` should be configured only with the
  redirect-bearing deployment.
- Repository ZIP removal remains a separate post-production-verification
  operation.
- No frontend files were modified; future file UI still requires explicit
  permission.
