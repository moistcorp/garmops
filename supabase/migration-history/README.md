# Archived migration history

These SQL files document the pre-production-v1 schema evolution. They are not
part of `supabase db push` or `supabase db reset`.

The matching files in `supabase/migrations` are intentionally retained as
version markers because all of those versions are already present in the linked
production migration ledger. The `20260804123000` baseline now builds only an
empty public schema and fails closed when application relations already exist.
This preserves deployed version identifiers without retaining an automatic
full-schema reset in the normal deployment path.

Never execute this archived history against a production database.
