-- Customer artwork is uploaded directly to R2, so the browser and upload
-- route limits are complemented by a database-side guard on new upload slots.
-- NOT VALID preserves any historical files while enforcing the limit on every
-- new customer_artwork row, including direct RPC callers.
alter table public.order_files
  add constraint order_files_customer_artwork_20mb
  check (kind <> 'customer_artwork' or byte_size <= 20971520)
  not valid;
