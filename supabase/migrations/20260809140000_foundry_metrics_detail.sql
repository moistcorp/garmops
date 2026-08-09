begin;

create index if not exists orders_status_estimated_dispatch_idx
  on public.orders(status, estimated_dispatch_at)
  where delivered_at is null and cancelled_at is null;
create index if not exists order_status_history_order_created_idx
  on public.order_status_history(order_id, created_at desc);

create or replace function public.foundry_business_metrics(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path='' as $$
  with paid as (
    select * from public.orders
    where amount_paid_paise=total_paise and confirmed_at::date between p_from and p_to
  ), totals as (
    select count(*) paid_orders,coalesce(sum(amount_paid_paise),0) gross,
      coalesce(sum(taxable_value_paise),0) taxable,coalesce(sum(tax_paise),0) gst,
      coalesce(avg(amount_paid_paise),0) aov from paid
  ), lines as (
    select oi.* from public.order_items oi join paid on paid.id=oi.order_id
  ), product_mix as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'productId',product_id,'productName',product_name,'units',units,
      'revenuePaise',revenue,'averageLineQuantity',average_quantity
    ) order by units desc),'[]'::jsonb) value
    from (select product_id,product_name,sum(quantity) units,sum(line_total_paise) revenue,
      round(avg(quantity),1) average_quantity from lines group by product_id,product_name) grouped
  ), stage_age as (
    select o.id,o.status,extract(epoch from(now()-coalesce(h.changed_at,o.confirmed_at)))/86400 age_days
    from public.orders o left join lateral (
      select max(created_at) changed_at from public.order_status_history where order_id=o.id
    ) h on true where o.cancelled_at is null and o.delivered_at is null
  )
  select case when public.current_staff_role()<>'founder' then null else jsonb_build_object(
    'paidOrders',totals.paid_orders,'grossPaidPaise',totals.gross,
    'taxableValuePaise',totals.taxable,'gstPaise',totals.gst,
    'averageOrderValuePaise',totals.aov,
    'unitsOrdered',(select coalesce(sum(quantity),0) from lines),
    'byProduct',product_mix.value,
    'quantityBands',(select coalesce(jsonb_object_agg(band,qty),'{}'::jsonb) from (
      select case when quantity<100 then '50_99' when quantity<250 then '100_249'
        when quantity<500 then '250_499' else '500_plus' end band,count(*) qty from lines group by 1
    ) q),
    'techniqueUsage',jsonb_build_object(
      'screenPrint',(select count(*) from lines where decoration_snapshot->>'frontTechnique'='screen_print' or decoration_snapshot->>'backTechnique'='screen_print'),
      'dtf',(select count(*) from lines where decoration_snapshot->>'frontTechnique'='dtf' or decoration_snapshot->>'backTechnique'='dtf'),
      'reflectivePrint',(select count(*) from lines where decoration_snapshot->>'frontTechnique'='reflective_print' or decoration_snapshot->>'backTechnique'='reflective_print')
    ),
    'configurationMix',jsonb_build_object(
      'customDyeLines',(select count(*) from lines where colour_snapshot->>'type'='custom_dye'),
      'customNeckLabelLines',(select count(*) from lines where neck_label_snapshot->>'type'='custom'),
      'frontOnlyLines',(select count(*) from lines where artwork_snapshot ? 'front' and not (artwork_snapshot ? 'back')),
      'frontAndBackLines',(select count(*) from lines where artwork_snapshot ? 'front' and artwork_snapshot ? 'back')
    ),
    'statusCounts',(select coalesce(jsonb_object_agg(status,qty),'{}'::jsonb) from (
      select status,count(*) qty from public.orders where created_at::date between p_from and p_to group by status
    ) s),
    'averageStageAgeDays',(select coalesce(jsonb_object_agg(status,average_days),'{}'::jsonb) from (
      select status,round(avg(age_days)::numeric,1) average_days from stage_age group by status
    ) a),
    'approachingExpectedDate',(select count(*) from public.orders where delivered_at is null and cancelled_at is null and estimated_dispatch_at between now() and now()+interval '7 days'),
    'overdueOrders',(select count(*) from public.orders where delivered_at is null and cancelled_at is null and estimated_dispatch_at<now())
  ) end from totals cross join product_mix
$$;

revoke all on function public.foundry_business_metrics(date,date) from public,anon;
grant execute on function public.foundry_business_metrics(date,date) to authenticated;

commit;
