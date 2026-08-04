-- Run manually after storing these secrets in Supabase Vault:
-- garmops_customer_origin = https://garmops.com
-- garmops_cron_secret = the same CRON_SECRET used in Vercel
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname in ('garmops-jobs-every-minute','garmops-payu-reconcile');
select cron.schedule('garmops-jobs-every-minute','* * * * *',$$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name='garmops_customer_origin') || '/api/internal/jobs/process',
    headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='garmops_cron_secret'))
  );
$$);
select cron.schedule('garmops-payu-reconcile','*/10 * * * *',$$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name='garmops_customer_origin') || '/api/internal/jobs/reconcile-payu',
    headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='garmops_cron_secret'))
  );
$$);
