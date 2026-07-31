# Phase 11 setup and acceptance runbook

## 1. Apply locally

From the repository root:

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
npm run lint
npm run typecheck
npm run test
npm run build
npm run seo:check
npm run agent:check
```

Do not hand-edit `src/types/database.generated.ts`; regenerate it after the migration.

## 2. Required configuration

Confirm the existing environment configuration:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ACCOUNTS_ENABLED=true
STAFF_PORTAL_ENABLED=true
DURABLE_CUSTOM_CHECKOUT_ENABLED=true
R2_PRIVATE_UPLOADS_ENABLED=true

AUTH_RATE_LIMIT_SALT=
RESEND_API_KEY=
RESEND_FROM_EMAIL="Garmops <orders@garmops.com>"
```

Also provide the existing private-R2 variables documented in `docs/backend/r2-setup.md`.

Use separate non-production credentials and a stable protected staging origin. Never send production R2 or Resend credentials to preview deployments.

## 3. Staff acceptance setup

Create test staff users with TOTP MFA and representative permissions:

- artwork/approval manager;
- QC user;
- shipment/operations user;
- read-only user.

Create test customer members representing:

- owner;
- approver;
- buyer;
- viewer.

## 4. Approval acceptance matrix

Test all of the following on staging:

1. Upload an approval PDF to private R2.
2. Finalize it and confirm the stored SHA-256 is a real 64-character lowercase digest.
3. Confirm a pending/manual-review PDF cannot be used for approval.
4. Clear the file using an authorised staff role.
5. Create a company-member approval request for a specific design version.
6. Confirm only owner/approver membership can decide it.
7. Confirm buyer/viewer cannot decide it.
8. Confirm approval creates durable evidence and audit history.
9. Request changes and confirm the order returns to artwork review.
10. Create a later design version and replacement approval.
11. Confirm the earlier approval cannot authorise the later version.
12. Approve the latest version and confirm production approval is permitted.
13. Confirm production approval is blocked without latest valid approval evidence.
14. Confirm a production-approved order cannot be silently reopened by issuing another request.
15. Confirm revoked and expired links cannot decide or download the PDF.
16. Confirm direct customer table reads do not expose token hashes, IP hashes, user agents, or external recipient email.

External manager flow:

1. Configure non-production Resend.
2. Create an external request and verify exactly one email is delivered.
3. Verify the email contains an HTTPS staging link.
4. Open the link and download the exact PDF.
5. Submit one decision.
6. Confirm a repeat decision is rejected safely.
7. Confirm a newer request invalidates the older link.
8. Remove Resend configuration and confirm the new unusable request is automatically revoked.
9. Simulate email-provider failure and confirm the request is revoked.

## 5. QC and document history

1. Upload QC evidence as the authorised QC role.
2. Confirm the default visibility is staff-only unless explicitly changed through an authorised workflow.
3. Confirm pending/manual-review evidence cannot be downloaded.
4. Confirm clean evidence downloads through a short-lived private URL.
5. Confirm customer-visible evidence appears in the order document vault.
6. Confirm staff-only evidence never appears to the customer.
7. Confirm another organisation cannot access any order file by changing a URL or file UUID.

## 6. Shipment and split-delivery acceptance

1. Create a shipment from an order ready for dispatch.
2. Confirm it receives a durable unique shipment number.
3. Confirm creation inserts a `preparing` event.
4. Confirm an order cannot transition to dispatched before a valid shipment dispatch event.
5. Move the package through dispatched, in transit, out for delivery, and delivered.
6. Confirm a backward status transition is blocked.
7. Confirm staff-only internal notes are absent from customer projections.
8. Confirm customer-visible notes create in-app notifications.
9. Create two shipments for one order.
10. Deliver the first and confirm the order cannot be marked delivered.
11. Deliver the second and confirm the order can then complete.
12. Test exception and cancellation branches.
13. Confirm cancelled packages do not block completion, while any active undelivered package does.
14. Confirm shipment tracking URLs must use HTTPS.
15. Confirm customer B cannot access customer A shipment events.

## 7. Reorder acceptance

1. Open a delivered custom order as owner/buyer.
2. Confirm current pricing and availability are recalculated.
3. Confirm historical and current estimates are shown when they differ.
4. Confirm unavailable/unparseable historical configurations require staff review.
5. Accept current reorder terms and create the reorder.
6. Confirm it receives a different order ID, order number, order date, design project, and design version.
7. Confirm the original delivered order is unchanged.
8. Confirm `source_order_id` points to the original and cannot be rewritten.
9. Confirm a reservation payment attempt is created for the new order.
10. Repeat the same idempotent submission and confirm no duplicate order is created.
11. Confirm buyer/viewer permission boundaries.
12. Complete PayU sandbox payment and confirm the Phase 8/9 workflow works for the reorder.

## 8. Notification centre

Confirm:

- approval requests appear for the correct company approver;
- approval responses notify the requesting staff user;
- customer-visible shipment updates notify active company members;
- notification links open only authorised resources;
- marking one/all notifications read works;
- staff-only text is never copied into customer notifications.

## 9. Performance and security checks

- Test approval and shipment queues with representative data volumes.
- Confirm queries are bounded and indexed.
- Confirm every sensitive staff workflow requires AAL2 MFA.
- Confirm read-only staff cannot mutate approval, QC, shipment, or file visibility.
- Confirm all security-definer functions use a fixed empty `search_path`.
- Confirm RLS remains enabled and forced for shipment events.
- Confirm no service-role, R2, Resend, or token secret reaches client bundles.
- Confirm bearer tokens are absent from logs and analytics URLs.
- Configure `Referrer-Policy: no-referrer` or an equivalently strict policy for external approval pages during Phase 13 hardening.

## 10. Staging sign-off

Phase 11 may be signed off only when:

- the clean local suite passes;
- all 51 Phase 11 pgTAP assertions pass;
- company and external approvals are tested;
- the exact approval PDF/hash can be proved after approval;
- split shipment completion works;
- customer-safe shipment projection is verified;
- customer document visibility is verified;
- reorder creates a fresh durable order and completes PayU sandbox checkout;
- operations, customer support, artwork/QC, and security reviewers sign off;
- rollback has been rehearsed on non-production infrastructure.

Do not start Phase 12 while resolving Phase 11 failures. Record every failure, fix, rerun, and final result in `docs/backend/phase-11-local-completion-report.md`.
