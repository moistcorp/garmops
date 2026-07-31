# Phase 10 staff operations runbook

## Scope

Phase 10 replaces the placeholder staff area with an operational workspace for existing durable orders. It does not create Phase 11 approval or shipment workflows; it displays those records and enforces their prerequisites when later-stage status transitions are attempted.

## Staff routes

- `/staff` — operational exception dashboard
- `/staff/orders` — bounded work queue with search, filters and pagination
- `/staff/orders/[orderNumber]` — complete order workspace
- `/staff/customers` and `/staff/customers/[organizationId]` — organisation view
- `/staff/invoices` — Zoho invoice queue and finance retry controls
- `/staff/files` — order-file register
- `/staff/audit` — audited staff/provider activity
- `/staff/settings/team` — staff invitations and deactivation
- `/staff/settings/security` — security posture
- `/staff/settings/integrations` — integration-health summary

Every route repeats the active-staff and AAL2 MFA checks. Proxy redirects are not treated as the final authorisation boundary.

## Mutation boundary

The browser has no direct `UPDATE` permission on `orders`. Operational changes call security-definer PostgreSQL functions that:

1. resolve the authenticated staff identity from `auth.uid()`;
2. require AAL2 through `staff_has_permission`;
3. lock the target row where concurrency matters;
4. validate role, current state and business prerequisites;
5. update the business record;
6. write status history, notifications and an audit record in the same transaction.

The primary RPCs are:

- `staff_transition_order`
- `staff_assign_order`
- `staff_set_order_priority`
- `staff_set_order_dates`
- `staff_add_order_comment`
- `staff_resolve_order_action`
- `staff_change_order_file_visibility`
- `staff_search_orders`
- `staff_dashboard_metrics`
- `staff_safe_payment_summary`
- `staff_list_assignable_members`

## Payment integrity

Staff cannot set `reservation_paid`, `payment_failed` or restore `awaiting_payment`. PayU callback/webhook verification from Phase 8 remains the only route that establishes provider payment truth. Staff may archive/cancel an unpaid order through the controlled state machine, with a cancellation reason.

## File safety

Private-file presigning requires the file to be finalised and have `scan_status` equal to `clean` or `not_required`. Pending, manual-review and rejected objects are not downloadable through the customer or staff browser UI. Changing a file from staff-only to customer-visible also requires a clean/not-required state and an audited reason.

## Expected dates

Dates are stored as UTC `timestamptz` and entered/displayed as India-local time. The sequence is:

```text
order submitted <= approval <= production <= QC <= dispatch
```

The migration adds the date constraints as `NOT VALID`, then validates them automatically when all historical rows comply. Before production rollout, check constraint validation:

```sql
select conname, convalidated
from pg_constraint
where conrelid = 'public.orders'::regclass
  and conname in (
    'orders_expected_dates_after_submission_check',
    'orders_expected_date_sequence_check'
  );
```

If either is not validated, identify and correct historical rows before running:

```sql
alter table public.orders
  validate constraint orders_expected_dates_after_submission_check;

alter table public.orders
  validate constraint orders_expected_date_sequence_check;
```

## Customer communication

Staff-only notes never appear in customer queries. Customer-visible updates and action requests create portal notifications for active organisation members. Customers may reply from the order page; replies are organisation-scoped by RLS and recorded in the audit log.

## Phase 11 boundary

Phase 10 only reads existing approval and shipment rows. Phase 11 must add:

- immutable approval-PDF creation and approval response workflows;
- QC evidence capture;
- shipment creation/update and tracking notifications;
- historical-document presentation and reorder/duplicate behaviour.
