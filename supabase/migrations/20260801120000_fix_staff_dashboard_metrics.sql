-- Repair the Phase 12 dashboard function for databases where the historical
-- migration was already applied. The original definition referenced an invalid
-- order_type enum label and a column that does not exist on public.orders.

create or replace function public.staff_dashboard_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.staff_has_permission('view_all_orders') then
      jsonb_build_object('denied', true)
    else jsonb_build_object(
      'newPaidReservations', (
        select count(*) from public.orders
        where order_type in ('custom_bulk', 'reorder')
          and status = 'reservation_paid'
      ),
      'newPaidSampleOrders', (
        select count(*) from public.orders
        where order_type = 'sample_purchase'
          and status = 'submitted_for_review'
          and amount_paid_paise >= estimated_total_paise
      ),
      'actionRequired', (
        select count(distinct customer_order.id)
        from public.orders as customer_order
        left join public.order_comments as comment
          on comment.order_id = customer_order.id
          and comment.action_required
          and comment.resolved_at is null
        where customer_order.status = 'needs_customer_action'
          or comment.id is not null
      ),
      'artworkOverdue', (
        select count(*) from public.orders
        where order_type in ('custom_bulk', 'reorder')
          and status in ('artwork_review', 'awaiting_artwork_approval')
          and expected_approval_at < now()
      ),
      'productionAtRisk', (
        select count(*) from public.orders
        where status in (
          'approved_for_production',
          'production_queued',
          'in_production',
          'quality_control',
          'packing'
        )
          and (
            expected_production_at <= now() + interval '3 days'
            or expected_qc_at <= now() + interval '3 days'
            or estimated_dispatch_at <= now() + interval '3 days'
          )
      ),
      'readyForQcDispatch', (
        select count(*) from public.orders
        where status in ('quality_control', 'ready_to_dispatch')
      ),
      'invoiceExceptions', (
        select count(*) from public.invoices
        where sync_status in ('retryable_failure', 'permanent_failure')
      ),
      'pendingPayu', (
        select count(*) from public.payment_attempts
        where status in ('initiated', 'pending')
          and created_at < now() - interval '30 minutes'
      ),
      'unassignedPriority', (
        select count(*) from public.orders
        where assigned_staff_user_id is null
          and internal_priority in ('high', 'urgent')
          and status not in ('delivered', 'cancelled', 'refunded', 'expired')
      )
    )
  end;
$$;

revoke all on function public.staff_dashboard_metrics() from public;
grant execute on function public.staff_dashboard_metrics() to authenticated;

comment on function public.staff_dashboard_metrics() is
  'Returns MFA-protected operational counters including fully paid sample orders.';
