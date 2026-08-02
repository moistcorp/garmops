create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(9);

select hasnt_table('public', 'approvals', 'approvals subsystem is removed');
select hasnt_table('public', 'design_estimates', 'saved estimates subsystem is removed');
select hasnt_table('public', 'notifications', 'notifications subsystem is removed');
select hasnt_table('public', 'order_comments', 'staff comments subsystem is removed');
select hasnt_table('public', 'shipments', 'shipments subsystem is removed');
select hasnt_table('public', 'shipment_events', 'shipment events subsystem is removed');

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'orders' and column_name = any(array[
          'estimate_id',
          'assigned_staff_user_id',
          'assigned_team',
          'internal_priority',
          'expected_approval_at',
          'expected_production_at',
          'expected_qc_at',
          'estimated_dispatch_at'
        ]))
        or (table_name = 'organizations' and column_name like 'zoho_%')
        or (table_name = 'invoices' and column_name like 'zoho_%')
      )
  ),
  0::bigint,
  'dormant order operations, estimate, and provider columns are removed'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'create_design_estimate_from_server',
        'customer_shipment_events',
        'defer_integration_job',
        'external_respond_order_approval',
        'link_order_to_estimate',
        'mark_all_notifications_read',
        'mark_notification_read',
        'respond_order_approval',
        'retry_invoice_integration_job',
        'review_file_scan',
        'staff_add_order_comment',
        'staff_approval_queue',
        'staff_assign_order',
        'staff_change_order_file_visibility',
        'staff_create_approval_request',
        'staff_create_shipment',
        'staff_dashboard_metrics',
        'staff_list_assignable_members',
        'staff_order_approvals',
        'staff_resolve_order_action',
        'staff_revoke_approval',
        'staff_safe_payment_summary',
        'staff_search_orders',
        'staff_set_order_dates',
        'staff_set_order_priority',
        'staff_update_shipment'
      ])
  ),
  0::bigint,
  'dormant public RPC surface is removed'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'create_sample_invoice_placeholder',
        'finalize_private_upload',
        'finalize_verified_payment'
      ])
      and procedure.prosrc ilike '%zoho%'
  ),
  0::bigint,
  'retained payment and upload functions contain no retired provider branches'
);

select * from finish();
rollback;
