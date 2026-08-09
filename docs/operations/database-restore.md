# Database restore and quarterly test

Never test a restore over production. Download the `.dump.gz` and checksum from the private `backups/supabase/YYYY/MM/DD/` prefix, verify `sha256sum -c`, and restore first into a disposable local or staging PostgreSQL/Supabase instance:

```bash
gunzip -c backup.dump.gz > backup.dump
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DISPOSABLE_DATABASE_URL" backup.dump
```

Confirm migrations expected by the deployed Git commit, authentication schema compatibility, row counts for orders/order items/payments/invoices/files, foreign-key integrity, paid-order totals, RLS behavior, and a sample invoice/order read. Record the backup timestamp, restore target, duration, checks performed, result, and operator. Run this drill quarterly and after material schema changes.

Supabase Pro managed daily backups and no-pausing are preferred once paid production orders are live. The GitHub/R2 workflow is the Free-plan fallback, not a replacement for restore testing. Configure a private R2 lifecycle for 30 daily copies and optional longer monthly retention; never apply that lifecycle to production customer-file prefixes.
