# Cost and capacity policy

Selected mode: development and internal testing
Expected incremental fixed cost: approximately ₹0/month, excluding the existing domain/hosting and payment transaction charges
Allowance check date: 2026-07-29

Provider account enrolment and actual usage must be confirmed in each dashboard. This file records the target plan and verified public allowance, not proof of the account's current subscription.

## Development plan and warning thresholds

| Provider | Selected development plan | Current included allowance | Internal warning/action threshold |
| --- | --- | --- | --- |
| Supabase | Free/local | 2 active projects; 500 MB database/project; 50,000 MAU; 5 GB egress plus 5 GB cached egress; Free cloud projects may pause after one week of inactivity | 400 MB database; 40,000 MAU; 4 GB in either egress category; any live-order dependence or unacceptable pause/recovery risk triggers Pro review |
| Cloudflare R2 | Standard | 10 GB-month storage; 1 million Class A and 10 million Class B operations/month; internet egress free | 8 GB-month; 800,000 Class A; 8 million Class B; keep Standard storage while active files fit the workload |
| Resend | Free transactional | 3,000 emails/month and 100/day | 2,400/month or 80/day, or earlier when delivery/support requirements increase |
| Cloudflare Turnstile | Free | 20 widgets; 10 hostnames/widget; unlimited challenges | 16 widgets or 8 hostnames/widget; Enterprise only for measured scale/compliance needs |
| PayU | Sandbox | No live processing; live fees are merchant-contract specific | Stay in sandbox through development; reconcile all test/live events and review the signed commercial schedule before launch |
| Vercel | Local/preview during development | No new production-plan decision in Phase 0 | Commercial production requires Pro; configure spend controls and review each included usage metric at 80% |

Official references:

- [Supabase pricing](https://supabase.com/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Resend pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing)
- [Cloudflare Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)
- [Vercel pricing](https://vercel.com/pricing)

Allowances and prices are operational inputs, not application constants. Recheck the official pages before production rollout and during the monthly review.

## Production cost gates

Commercial production must not use Vercel Hobby.

- Controlled pilot: Vercel Pro plus a dedicated Supabase Free project may be considered only with owner approval, encrypted off-site dumps, a completed restore drill, usage monitoring, and an accepted manual recovery window. Planning estimate: ₹2,000–₹2,500/month plus tax, foreign-exchange effects, PayU fees, and overages.
- Reliable production: Vercel Pro (currently $20/month) plus Supabase Pro (currently from $25/month), while R2, Resend, and Turnstile remain inside their early-volume free allowances. Planning floor: $45/month before tax and usage, approximately ₹5,000–₹5,500/month using the implementation guide's conservative budgeting.

The selected Phase 0 mode is development/internal testing. No production plan or paid service purchase is authorised by this selection.

## Backup and recovery posture

Local Supabase is disposable and rebuilt from committed migrations and deterministic seeds. A shared Free development project has no assumed managed backup: take a logical dump before risky schema work and at least weekly while it contains useful shared test data, encrypt retained copies, and keep them outside that project.

Before a controlled live pilot:

1. Migrations and database types are committed.
2. Encrypted, dated logical dumps are stored off-site with multiple generations.
3. A clean-project restore is completed and documented.
4. Backup freshness, database size, egress, and project activity are reviewed.
5. The owner accepts Free-plan pause/support/recovery limitations in writing.

Move to Supabase Pro before the portal is the sole operational record for meaningful orders, or sooner when pausing, recovery time, managed backups, support, database size, egress, or business dependence crosses the documented risk threshold.

R2 lifecycle rules may remove abandoned temporary uploads only after the retention policy is approved. They must never automatically delete order evidence, verified payment records, legal invoices, accepted approvals, or active-order documents.

## Monthly capacity review

Record Supabase database/MAU/egress/backup state; R2 storage and Class A/B operations; Resend daily/monthly sends and failures; in-house invoice generation failures; Vercel usage/cron health; PostgreSQL job backlog/dead jobs; and PayU reconciliation exceptions.

No Redis, managed queue, external search, SMS, WhatsApp, social login, paid monitoring, separate backend, or global Realtime is approved for Phase 1. Each future recurring service proposal must state its cost, purpose, free alternative considered, and measured upgrade trigger.
