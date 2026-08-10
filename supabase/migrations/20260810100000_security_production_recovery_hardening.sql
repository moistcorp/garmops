-- Security and production-integrity follow-up for the operations tables.
-- This is intentionally a forward migration: the earlier migrations remain
-- immutable history.

begin;

-- Keep scanner state independent even for future workflow functions: browser
-- and staff-authenticated mutations may change review metadata, but only the
-- service-role scanner worker can write scan_status.
create or replace function public.protect_artwork_scan_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'customer_artwork'
     and new.scan_status is distinct from old.scan_status
     and coalesce(auth.role(), '') <> 'service_role' then
    new.scan_status := old.scan_status;
  end if;
  return new;
end;
$$;

drop trigger if exists order_files_protect_artwork_scan_status on public.order_files;
create trigger order_files_protect_artwork_scan_status
before update of scan_status on public.order_files
for each row execute function public.protect_artwork_scan_status();

revoke all on function public.protect_artwork_scan_status() from public, anon, authenticated;

-- Human review is not a malware verdict.  Scanner workers are the only normal
-- authority allowed to change scan_status to a terminal scanner state.
create or replace function public.review_artwork_file(
  p_file_id uuid,
  p_decision public.artwork_review_status,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_order public.orders%rowtype;
  v_requirement public.order_artwork_requirements%rowtype;
begin
  if not public.staff_has_permission('review_artwork') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if p_decision not in ('approved','changes_requested','rejected') then
    raise exception 'INVALID_ARTWORK_DECISION';
  end if;

  select * into v_file
  from public.order_files
  where id = p_file_id
    and kind = 'customer_artwork'
    and deleted_at is null
    and upload_status = 'finalized'
  for update;
  if not found then raise exception 'FILE_NOT_FOUND'; end if;
  if p_decision <> 'approved' and nullif(btrim(p_reason),'') is null then
    raise exception 'REASON_REQUIRED';
  end if;

  if v_file.order_id is not null then
    select * into v_requirement
    from public.order_artwork_requirements
    where order_id = v_file.order_id and file_id = v_file.id and is_active
    for update;
    if not found then raise exception 'ARTWORK_REVISION_SUPERSEDED'; end if;

    select * into v_order from public.orders where id = v_file.order_id for update;
    if v_order.status in (
      'material_preparation','printing_embroidery','stitching','quality_check',
      'packing','ready_to_dispatch','dispatched','delivered'
    ) and p_decision is distinct from v_file.review_status then
      raise exception 'ORDER_PRODUCTION_LOCKED';
    end if;
  end if;

  update public.order_files
  set review_status = p_decision,
      review_reason = nullif(btrim(p_reason),''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_file_id;

  if v_file.order_id is not null
     and p_decision in ('changes_requested','rejected')
     and v_order.status in ('artwork_approved','production_approved') then
    update public.orders
    set status = 'artwork_pending',
        public_status = 'artwork_under_review',
        artwork_approved_at = null,
        production_approved_configuration_revision = null
    where id = v_file.order_id;

    insert into public.order_status_history(
      order_id, from_status, to_status, public_status, actor_type, actor_user_id,
      customer_visible, customer_message, internal_note, reason, metadata
    ) values (
      v_file.order_id, v_order.status, 'artwork_pending', 'artwork_under_review',
      'staff', auth.uid(), true,
      'Artwork changes are required before production can continue.',
      'Production approval invalidated by artwork review.', btrim(p_reason),
      jsonb_build_object('fileId', p_file_id,
                         'requirementKey', v_requirement.requirement_key)
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state
  ) values (
    auth.uid(), 'staff', 'artwork.reviewed', 'order_file', p_file_id, v_file.order_id,
    jsonb_build_object('decision', v_file.review_status,
                       'reviewedBy', v_file.reviewed_by,
                       'reviewedAt', v_file.reviewed_at,
                       'scanStatus', v_file.scan_status),
    jsonb_build_object('decision', p_decision, 'reason', p_reason,
                       'scanStatus', v_file.scan_status,
                       'requirementKey', v_requirement.requirement_key)
  );
  return true;
end;
$$;

-- RLS decides which rows are visible/mutable; these grants only make the
-- intended authenticated operations possible after the earlier blanket revoke.
grant select, insert, update on public.customer_privacy_preferences to authenticated;
grant select, insert, update on public.privacy_requests to authenticated;
grant select, insert, update on public.production_working_days to authenticated;
grant select, insert, update on public.production_blackout_dates to authenticated;
grant select, insert, update on public.production_capacity_rules to authenticated;
grant select, insert, update on public.production_lead_time_rules to authenticated;

-- Founder-only production writes require MFA at the database boundary.
drop policy if exists production_working_days_founder_write on public.production_working_days;
create policy production_working_days_founder_write
on public.production_working_days for all to authenticated
using (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied())
with check (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied());

drop policy if exists production_blackout_founder_write on public.production_blackout_dates;
create policy production_blackout_founder_write
on public.production_blackout_dates for all to authenticated
using (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied())
with check (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied());

drop policy if exists production_capacity_founder_write on public.production_capacity_rules;
create policy production_capacity_founder_write
on public.production_capacity_rules for all to authenticated
using (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied())
with check (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied());

drop policy if exists production_lead_founder_write on public.production_lead_time_rules;
create policy production_lead_founder_write
on public.production_lead_time_rules for all to authenticated
using (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied())
with check (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied());

drop policy if exists principals_own_select on public.account_principals;
create policy principals_own_select
on public.account_principals for select to authenticated
using (
  user_id = auth.uid()
  or (public.current_staff_role() = 'founder' and public.staff_mfa_satisfied())
);

-- This RPC is callable by authenticated users for compatibility with the
-- Foundry page, but it returns no business data unless the DB session has AAL2.
create or replace function public.foundry_business_metrics(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with paid as (
    select * from public.orders
    where amount_paid_paise = total_paise
      and confirmed_at::date between p_from and p_to
  ), totals as (
    select count(*) paid_orders,
      coalesce(sum(amount_paid_paise),0) gross,
      coalesce(sum(taxable_value_paise),0) taxable,
      coalesce(sum(tax_paise),0) gst,
      coalesce(avg(amount_paid_paise),0) aov
    from paid
  ), lines as (
    select oi.* from public.order_items oi join paid on paid.id = oi.order_id
  ), product_mix as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'productId', product_id, 'productName', product_name,
      'units', units, 'revenuePaise', revenue,
      'averageLineQuantity', average_quantity
    ) order by units desc), '[]'::jsonb) value
    from (
      select product_id, product_name, sum(quantity) units,
        sum(line_total_paise) revenue, round(avg(quantity),1) average_quantity
      from lines group by product_id, product_name
    ) grouped
  ), stage_age as (
    select o.id, o.status,
      extract(epoch from (now() - coalesce(h.changed_at, o.confirmed_at))) / 86400 age_days
    from public.orders o left join lateral (
      select max(created_at) changed_at from public.order_status_history where order_id = o.id
    ) h on true
    where o.cancelled_at is null and o.delivered_at is null
  )
  select case
    when public.current_staff_role() <> 'founder'
      or not public.staff_mfa_satisfied() then null
    else jsonb_build_object(
      'paidOrders', totals.paid_orders,
      'grossPaidPaise', totals.gross,
      'taxableValuePaise', totals.taxable,
      'gstPaise', totals.gst,
      'averageOrderValuePaise', totals.aov,
      'unitsOrdered', (select coalesce(sum(quantity),0) from lines),
      'byProduct', product_mix.value,
      'quantityBands', (select coalesce(jsonb_object_agg(band,qty),'{}'::jsonb) from (
        select case when quantity < 100 then '50_99' when quantity < 250 then '100_249'
          when quantity < 500 then '250_499' else '500_plus' end band, count(*) qty
        from lines group by 1
      ) q),
      'techniqueUsage', jsonb_build_object(
        'screenPrint', (select count(*) from lines where decoration_snapshot->>'frontTechnique'='screen_print' or decoration_snapshot->>'backTechnique'='screen_print'),
        'dtf', (select count(*) from lines where decoration_snapshot->>'frontTechnique'='dtf' or decoration_snapshot->>'backTechnique'='dtf'),
        'reflectivePrint', (select count(*) from lines where decoration_snapshot->>'frontTechnique'='reflective_print' or decoration_snapshot->>'backTechnique'='reflective_print')
      ),
      'configurationMix', jsonb_build_object(
        'customDyeLines', (select count(*) from lines where colour_snapshot->>'type'='custom_dye'),
        'customNeckLabelLines', (select count(*) from lines where neck_label_snapshot->>'type'='custom'),
        'frontOnlyLines', (select count(*) from lines where artwork_snapshot ? 'front' and not (artwork_snapshot ? 'back')),
        'frontAndBackLines', (select count(*) from lines where artwork_snapshot ? 'front' and artwork_snapshot ? 'back')
      ),
      'statusCounts', (select coalesce(jsonb_object_agg(status,qty),'{}'::jsonb)
        from (select status,count(*) qty from public.orders
              where created_at::date between p_from and p_to group by status) s),
      'averageStageAgeDays', (select coalesce(jsonb_object_agg(status,average_days),'{}'::jsonb) from (
        select status, round(avg(age_days)::numeric,1) average_days from stage_age group by status
      ) a),
      'approachingExpectedDate', (select count(*) from public.orders where delivered_at is null and cancelled_at is null and estimated_dispatch_at between now() and now()+interval '7 days'),
      'overdueOrders', (select count(*) from public.orders where delivered_at is null and cancelled_at is null and estimated_dispatch_at < now())
    )
  end
  from totals cross join product_mix
$$;

revoke all on function public.foundry_business_metrics(date,date) from public, anon;
grant execute on function public.foundry_business_metrics(date,date) to authenticated;

-- Current multi-item snapshots keep the authoritative design identity under
-- configuration_snapshot.items[].designProjectId. Failed/expired checkouts are
-- not orders and therefore do not suppress recovery.
create or replace function public.enqueue_abandoned_design_recovery(
  p_inactive_interval interval default interval '72 hours'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  insert into public.integration_jobs(job_type, deduplication_key, payload)
  select 'send_saved_design_recovery',
    'saved-design-recovery:' || d.id::text || ':' || to_char(now() at time zone 'UTC','YYYY-MM-DD'),
    jsonb_build_object('designId', d.id, 'customerUserId', d.created_by)
  from public.design_projects d
  join public.customer_privacy_preferences p on p.customer_user_id = d.created_by
  where d.status = 'draft'
    and d.archived_at is null
    and d.updated_at < now() - p_inactive_interval
    and p.recovery_messages_enabled
    and not exists (
      select 1
      from public.orders o
      where o.customer_user_id = d.created_by
        and o.amount_paid_paise = o.total_paise
        and o.status not in ('cancelled','refund_pending','refunded')
        and (
          o.configuration_snapshot ->> 'designProjectId' = d.id::text
          or exists (
            select 1
            from jsonb_array_elements(
              case when jsonb_typeof(o.configuration_snapshot -> 'items') = 'array'
                   then o.configuration_snapshot -> 'items' else '[]'::jsonb end
            ) item
            where item.value ->> 'designProjectId' = d.id::text
          )
        )
    )
  on conflict(deduplication_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_abandoned_design_recovery(interval) from public, anon, authenticated;
grant execute on function public.enqueue_abandoned_design_recovery(interval) to service_role;

commit;
