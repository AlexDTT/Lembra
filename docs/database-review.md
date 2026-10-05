# Database review before applying migrations

`0001_init.sql` remains unchanged. This review covers the initial migrations; current database tests execute migrations `0001` through `0005` and `0007` through `0010` with Supabase Auth and Storage helpers stubbed. Migration `0006` needs Supabase extensions and must be verified separately. No hosted project is included.

## Findings

- RLS checks each row's `user_id`, but foreign keys originally allowed references to a different user's event, category or completion. `0002_harden_ownership.sql` adds composite ownership foreign keys without removing any RLS policy.
- Authenticated clients originally could modify `google_event_id`, `google_synced_at` and `google_sync_error`. A trigger in `0002` reserves these fields for service writes.
- The initial schema relies on Supabase default authenticated/service grants. `0002` makes those grants explicit, retaining the anonymous revocations.
- Existing users are not backfilled by the signup trigger. If accounts already existed before applying `0001`, add settings/categories for them separately and verify their emails are allowed.
- Category kinds, valid IANA time zones, negative reminder lead times and `ends_at >= starts_at` are not constrained by `0001`. Medication input is validated at the client and RPC in this phase. Other event types need corresponding validation when implemented.
- The existing sync trigger only enqueues deletes for events with a known Google ID. The later sync worker must resolve queued upserts whose event was deleted, including deletion during an in-flight sync.
- `push_sent` deduplicates by occurrence, not lead time or device. Review this design when implementing push.

## Reproducing setup

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push
pnpm dlx supabase gen types typescript --linked
```

Save the last command's output as `src/types/database.ts`, then run `pnpm typecheck`. Never paste service-role keys or Google secrets into the frontend.

Apply all migrations through `0010`. Before signup, insert your approved lowercase emails into `public.allowed_emails` using the SQL editor. Configure Google-only auth and the redirect URL `http://localhost:5173/auth/callback`.
