-- Align durable checkout JSON handling and trusted server access with the
-- contracts used by the application.

alter table public.order_items
  drop constraint if exists order_items_neck_label_snapshot_check;

alter table public.order_items
  add constraint order_items_neck_label_snapshot_check
  check (
    neck_label_snapshot is null
    or jsonb_typeof(neck_label_snapshot) in ('object', 'null')
  );

-- The server-side Supabase client uses the service-role key for provider
-- callbacks, background jobs, and external approval flows. BYPASSRLS does not
-- itself grant table privileges, so grant the DML privileges those paths need.
grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select, update
  on all sequences in schema public
  to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
