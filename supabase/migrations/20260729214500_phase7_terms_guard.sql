create function public.require_phase7_order_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_type in ('custom_bulk', 'reorder')
    and new.pricing_version = 'custom-configurator-v1-2026-07-29'
    and (
      new.terms_snapshot -> 'accepted' is distinct from 'true'::jsonb
      or nullif(btrim(new.terms_snapshot ->> 'version'), '') is null
    )
  then
    raise exception using
      errcode = '22023',
      message = 'accepted order terms and version are required';
  end if;

  return new;
end;
$$;

revoke execute on function public.require_phase7_order_terms() from public, anon, authenticated;

create trigger orders_require_phase7_terms
before insert on public.orders
for each row
execute function public.require_phase7_order_terms();

comment on function public.require_phase7_order_terms() is
  'Rejects Phase 7 custom-order inserts that do not include an accepted, versioned terms snapshot.';
