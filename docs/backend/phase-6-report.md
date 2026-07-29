# Phase 6 implementation report

Date: 2026-07-29
Scope: cloud design projects, browser draft and IndexedDB import, private R2
artwork upload, optimistic autosave, immutable version creation, conflict
handling, and customer account design screens.

## Outcome

Phase 6 is implemented with the owner's explicit frontend permission.

Customers can now:

- keep using the configurator without signing in;
- save an in-progress Studio design to their account;
- import existing Studio and cart drafts found in the current browser;
- upload referenced IndexedDB artwork through private presigned R2 URLs;
- keep the local browser copy until cloud persistence succeeds;
- resume a cloud design from `/account/designs` on another device;
- choose between device, cloud, or copy when revisions conflict;
- create immutable design versions;
- duplicate and archive designs;
- download the current design PDF;
- see immutable version history and any orders that reference the design.

The additive database migration is applied to the linked Supabase Development
project. `CLOUD_DESIGNS_ENABLED=true` is configured only in Vercel
Development. Preview and Production remain unchanged.

## Data model and transaction boundary

Migration:

- `20260729170000_cloud_design_projects.sql`.

`design_projects` now includes:

- `draft_snapshot`, the mutable current configurator state;
- `pricing_input_snapshot`, the mutable non-authoritative pricing inputs;
- `draft_revision`, the optimistic concurrency token;
- `client_import_id`, a replay-safe browser operation UUID;
- `archived_at`, for retained soft archives.

Existing project rows are backfilled from their current immutable version.

All browser INSERT and UPDATE privileges on design projects and version INSERT
privileges are revoked. Authenticated mutations use reviewed security-definer
functions:

- `create_cloud_design`;
- `save_cloud_design_draft`;
- `create_cloud_design_version`;
- `duplicate_cloud_design`;
- `archive_cloud_design`.

Creation and duplication use a client UUID plus an advisory transaction lock,
so a retried request returns the same row. Autosave locks the project and
compares the expected revision. A stale request returns the current server
revision and snapshot without changing data. Version creation atomically
increments both the immutable version number and draft revision.

Submitted and archived projects are not editable. The existing append-only
trigger still blocks updates and deletes of `design_project_versions`.
Existing orders continue to reference an exact immutable design-version ID,
so later draft edits cannot change an order snapshot.

Design import, version creation, and archive operations write audit records.

## API and application layers

Typed route handlers:

- `GET|POST /api/designs`;
- `GET|PATCH|DELETE /api/designs/:designId`;
- `POST /api/designs/:designId/versions`;
- `POST /api/designs/:designId/duplicate`.

The route layer:

- fails closed behind `CLOUD_DESIGNS_ENABLED`;
- requires a verified Supabase user;
- requires exact configured Origin on mutations;
- enforces private/no-store responses;
- limits JSON request size;
- validates the current configurator schema with Zod;
- maps stale saves to HTTP `409`;
- uses tenant RLS for reads and database authorization for writes.

`src/lib/designs/dal.ts` owns typed database access. Design schemas and the
current schema version live in `src/lib/designs/schema.ts`. Unknown future
versions, browser `blob:` URLs, and IndexedDB keys are rejected by the server
schema.

## Browser import and R2 files

The existing browser stores remain supported:

- `mf_configurator_build:*` for Studio drafts;
- `mf_configurator_cart:*` for carts;
- `mf-configurator-uploads` IndexedDB for file blobs.

The account importer scans and normalizes those drafts. It never clears the
local copy. For each referenced upload it:

1. creates the cloud project and initial version;
2. reads the blob from IndexedDB;
3. requests a design-scoped private upload slot;
4. sends the blob directly to R2 with the signed headers;
5. finalizes it through the Phase 5 HEAD-verification route;
6. replaces the browser-only reference in the cloud snapshot with the
   PostgreSQL file ID;
7. saves the complete cloud draft and freezes the imported version.

The local cloud link records the project ID, current revision, version, and
file-key-to-file-ID mapping. This makes interrupted uploads retryable without
discarding the browser draft.

Customer uploads retain the Phase 5 `manual_review` state. Design metadata,
selections, dimensions, techniques, and quantities resume immediately on
another device. The original private artwork preview/download remains
unavailable until staff marks it clean; unsafe SVG is never rendered inline.

## Studio autosave and conflicts

The existing 450 ms local autosave remains first. A linked authenticated
design then receives a separate debounced cloud save. Local failure never
crashes the configurator, and cloud failure never deletes the local fallback.

Every cloud save sends the last known `draft_revision`. If another device or
tab saved first, the Studio displays:

- **Use this device**: save the current device draft against the returned
  server revision;
- **Use cloud version**: restore the newer server snapshot;
- **Create a copy**: create an independent replay-safe project.

No branch silently overwrites the newer revision.

`migrateConfiguratorDraft(input, fromVersion, toVersion)` is the explicit local
schema migration boundary. Version 1 is normalized today; unknown future
versions are refused and left recoverable.

## Account design screens

`/account/designs` provides:

- active/all filters;
- local browser-draft import;
- title, product, status, current version, and last-save information;
- a path back to the configurator.

`/account/designs/:designId` provides:

- current configuration metrics;
- resume in Studio;
- current design PDF generation;
- immutable version creation and history;
- duplicate and archive actions;
- order/version references.

Legacy snapshots that do not match the current configurator envelope remain
retained and display a safe migration-required state instead of being edited.

## Rollout flag

`CLOUD_DESIGNS_ENABLED` is server-only, exact-`true`, and defaults off.
Environment validation requires:

- accounts enabled;
- Supabase public/session configuration;
- a Supabase secret/service boundary;
- private R2 uploads enabled and fully configured.

The flag is present and enabled in Vercel Development only. The local ignored
environment remains off unless its complete Supabase and R2 dependencies are
configured. Preview and Production are not enabled.

## Validation

| Check | Result |
| --- | --- |
| Clean local database rebuild | Passed |
| Supabase pgTAP | Passed; 6 files, 366 assertions |
| Phase 6 concurrency/immutability pgTAP | Passed; 47 assertions |
| Local Supabase schema lint | Passed; no errors |
| Hosted migration apply | Passed |
| Hosted migration history | Local and remote versions match |
| Hosted Supabase schema lint | Passed; no errors |
| Generated database types | Passed |
| TypeScript | Passed |
| ESLint | Passed; no warnings |
| Vitest | Passed; 6 files, 31 tests |
| Next.js production build | Passed; design pages and four API route entries present |
| Vercel Development flag | Present and enabled |

The first sandboxed Next.js build failed because Turbopack could not bind its
internal CSS-worker port. The approved unrestricted rerun passed; this was a
sandbox restriction, not an application error.

## Rollout boundary

- Phase 6 is enabled only in Development.
- Preview and Production require an explicit rollout decision and deployment.
- Original customer artwork remains review-gated.
- Durable order submission remains Phase 7. The Phase 6 portal only displays
  order links already present in the database.
- No repository push or deployment is part of this report; those remain
  separate user-authorized delivery actions.
