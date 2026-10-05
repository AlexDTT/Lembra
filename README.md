# Lembra

> A calm, private life organizer for one person: medications, appointments, bills, budgets and expenses, with reminders that actually arrive.

"Lembra" is Portuguese for "remembers" (as in "it remembers for you").

---

## Table of contents

1. [Why this exists](#1-why-this-exists)
2. [Goals and principles](#2-goals-and-principles)
3. [Features](#3-features)
4. [Tech stack](#4-tech-stack)
5. [Architecture](#5-architecture)
6. [Reminders strategy](#6-reminders-strategy)
7. [Google Calendar sync](#7-google-calendar-sync)
8. [Authentication, privacy and security](#8-authentication-privacy-and-security)
9. [Data model](#9-data-model)
10. [Recurrence and time zones](#10-recurrence-and-time-zones)
11. [UX and accessibility rules](#11-ux-and-accessibility-rules)
12. [Repository structure](#12-repository-structure)
13. [Setup guide](#13-setup-guide)
14. [Environment variables and secrets](#14-environment-variables-and-secrets)
15. [Deployment](#15-deployment)
16. [Backups and recovery](#16-backups-and-recovery)
17. [Roadmap](#17-roadmap)
18. [Testing](#18-testing)
19. [Risks and known limitations](#19-risks-and-known-limitations)
20. [Decision log](#20-decision-log)
21. [Product decisions (formerly open questions)](#21-product-decisions-formerly-open-questions)
22. [Non-goals](#22-non-goals)

---

## 1. Why this exists

Lembra is built for one specific person: my mother. She needs one simple place to keep track of the things that are easy to forget and costly to miss:

- Which medication to take, and when.
- Medical and other appointments.
- Which bills to pay, and by when.
- How much she plans to spend, and how much she has spent.

The source is open under the [MIT license](LICENSE). The app is designed for private, invite-only deployments, with each deployment using its own accounts and infrastructure. Every design decision favors reliability, simplicity and privacy over features and scale. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [publication checklist](docs/public-release.md).

## 2. Goals and principles

1. **Reminders must arrive.** A missed medication reminder matters far more than any other feature. Reliability of notifications beats everything else.
2. **Simple enough for a non-technical user.** Few screens, large text, large buttons, clear words.
3. **Private by default.** Health and financial data. One user, no public signups, no third-party analytics, no card numbers or bank credentials stored, ever.
4. **Works on Android and PC.** One codebase, one URL. Installable on the phone, usable in a desktop browser.
5. **Costs nothing to run.** Everything runs on free tiers. No VPS to pay for, patch or secure.
6. **Small and maintainable.** One language (TypeScript), few moving parts, boring technology.
7. **The database is the source of truth.** Google Calendar is a display and notification layer, never the master copy.
8. **Portuguese first.** The default UI language is pt-PT, with English supported through the i18n layer.

## 3. Features

### MVP

| Area                     | What it does                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Medications**          | Create a medication with dose and one or more daily times. Reminders at each time. A big "Taken" button per dose, with history (useful to show a doctor).                                         |
| **Appointments**         | Create appointments with date, time, place and notes. Organized by category (Medical, Dental, Family, Other, and custom ones).                                                                    |
| **Bills**                | Create bills with amount and due date, one-off or recurring. Reminder before the due date. A "Paid" button per occurrence. **Marking a bill as paid automatically creates the matching expense.** |
| **Calendar**             | Month, week and agenda views showing everything in one place.                                                                                                                                     |
| **Google Calendar sync** | One-way sync from Lembra to her Google Calendar, so Google's native notifications also fire.                                                                                                      |
| **Budgets**              | A monthly budget per expense category **and** an overall monthly budget, with progress (spent versus budget).                                                                                     |
| **Expenses**             | Quick expense entry with category, amount, date and note. Monthly totals by category and overall.                                                                                                 |
| **Today screen**         | The home screen. Shows only today: medications to take, appointments, bills due.                                                                                                                  |

### Later (post-MVP ideas)

- **AI features** (scope to be defined; see [section 21](#21-product-decisions-formerly-open-questions)).
- Optional follow-up reminders and ten-minute snoozes are implemented; they describe unrecorded doses, never infer a missed dose.
- Dedicated "Lembra" calendar inside Google Calendar instead of the primary one.
- Spending charts by month and year.
- Optional read-only family view is implemented for approved relatives, with explicit area selection and revocation.

## 4. Tech stack

The stack is intentionally small. All of it is free at this scale.

| Layer              | Choice                                     | Why                                                             |
| ------------------ | ------------------------------------------ | --------------------------------------------------------------- |
| Language           | TypeScript everywhere                      | One language for frontend and server code.                      |
| Frontend           | React + Vite                               | Largest ecosystem and most documentation.                       |
| Styling            | Material UI + Tailwind CSS                 | Fast to build large, consistent, accessible UI.                 |
| Routing            | React Router                               | Standard and simple.                                            |
| Server state       | TanStack Query                             | Caching, retries and optimistic updates against Supabase.       |
| PWA                | `vite-plugin-pwa` (Workbox)                | Manifest, service worker, installability, push handler.         |
| Recurrence         | `rrule`                                    | Standard RRULE strings that Google Calendar also understands.   |
| Dates              | `date-fns` and `date-fns-tz`               | Small and predictable.                                          |
| Charts             | Chart.js (via `react-chartjs-2`)           | Light, enough for budgets.                                      |
| Hosting (frontend) | Cloudflare Pages                           | Free, fast, HTTPS included.                                     |
| Database           | Supabase (managed Postgres)                | Free tier, real Postgres, backups are our job (see section 16). |
| Auth               | Supabase Auth with Google provider         | No password to leak or forget.                                  |
| Server code        | Supabase Edge Functions (Deno, TypeScript) | Only for things the browser must not do.                        |
| Scheduling         | `pg_cron` + `pg_net`                       | Triggers Edge Functions on a schedule.                          |
| Push               | Web Push (VAPID)                           | Bonus notification channel on top of Google Calendar.           |
| CI and backups     | GitHub Actions                             | Tests on push; optional private-repository backups.             |
| Package manager    | pnpm                                       | Fast, strict.                                                   |
| Tests              | Vitest (unit), Playwright (browser)        | Recurrence and money logic must be tested.                      |

### Alternatives considered

- **Native Android app** (Kotlin, Flutter, React Native): more hassle (APK or store distribution), does not cover her PC, and gives nothing this project needs.
- **Traditional MVC backend** (Laravel, Django, Rails): a fine choice technically, but it needs an always-on server, and free hosts sleep, which breaks scheduled reminders.
- **SQLite on a free host**: free hosts generally lack persistent disks.
- **Cloudflare Workers + D1**: viable and free, but auth and cron would be hand-built.
- **Local-only storage** (IndexedDB): most private, but no sync between phone and PC, and data is lost if the browser storage is cleared.

## 5. Architecture

```
   Android phone (installed PWA)          PC browser
              \                              /
               \                            /
                v                          v
        +-------------------------------------------+
        |  React PWA on Cloudflare Pages            |
        |  (static files, no server of our own)     |
        +---------------------+---------------------+
                              |
                  Supabase JS client (HTTPS)
                              |
                              v
        +-------------------------------------------+
        |  Supabase                                  |
        |  - Auth (Google login, allowlist)          |
        |  - Postgres + Row Level Security           |
        |  - Edge Functions (Deno / TypeScript)      |
        |  - pg_cron + pg_net (scheduler)            |
        +-------+-----------------------+-----------+
                |                       |
                v                       v
        Google Calendar API        Web Push service
        (events + notifications)   (browser push)
```

### Who does what

- **The browser** reads and writes her data directly through the Supabase API. Row Level Security guarantees she can only ever touch her own rows.
- **Edge Functions** handle everything that needs a secret or must run without the browser open:
  - `store-google-token`: saves the Google refresh token securely after login.
  - `calendar-sync`: pushes changes to Google Calendar.
  - `send-reminders`: sends web push notifications for due items.
- **pg_cron** calls the Edge Functions every minute.

## 6. Reminders strategy

Reminders are the most important feature, so there are two independent layers.

1. **Google Calendar notifications (primary, most reliable).** Every medication, appointment and bill becomes a Google Calendar event with popup reminders. Google's Calendar app on Android delivers these very reliably, even when the PWA is closed. This layer needs no push infrastructure of our own.
2. **Web push from Lembra (secondary, bonus).** A scheduled job finds occurrences that are due and sends a push notification to her subscribed devices. It adds richer content and works even if she does not use Google Calendar notifications, but browser push is inherently less reliable than a native app.

Rules:

- Never depend on a single layer for medication.
- The Google Calendar app must be installed on her phone with notifications allowed. This is part of the setup checklist.
- The app should show a clear warning if push permission is denied or Google sync is failing.

### Default reminder lead times

| Type        | Default reminders                |
| ----------- | -------------------------------- |
| Medication  | At the exact time                |
| Appointment | 1 day before and 1 hour before   |
| Bill        | 3 days before and on the due day |

These are defaults only; each item can override them via `reminder_minutes[]`.

## 7. Google Calendar sync

### Direction: one-way (Lembra to Google)

Lembra is the source of truth. Google Calendar receives copies. Edits made directly in Google Calendar are not read back. This avoids webhooks, sync tokens and conflict resolution, which are the painful parts of two-way sync. The UI tells her to edit in Lembra.

### Mapping

- One Lembra `events` row maps to exactly one Google Calendar event (`google_event_id`).
- A medication taken at two times a day is stored as **two event rows** that share a `group_id` (see section 9). Each has its own simple recurrence rule. This keeps the 1:1 mapping and avoids relying on sub-daily recurrence rules (`BYHOUR`), which Google Calendar does not handle reliably.
- Recurrence is sent as `recurrence: ["RRULE:..."]` with `start.dateTime` and `start.timeZone`.
- Reminders are sent as `reminders: { useDefault: false, overrides: [{ method: "popup", minutes: N }] }`.
- Each Google event carries `extendedProperties.private.lembraEventId` so syncing is idempotent and events can be re-linked if a `google_event_id` is ever lost.

### Outbox pattern (reliable and retryable)

Database triggers on `events` write rows into `sync_outbox` (`upsert` or `delete`). The `calendar-sync` function processes the outbox:

- Runs on a schedule (every minute via `pg_cron`) and can also be invoked by the frontend right after a change for instant feedback.
- On success it sets `events.google_event_id`, `google_synced_at` and clears `google_sync_error`.
- On failure it records the error, increments `attempts`, and retries with backoff.
- Triggers ignore updates that only touch `google_*` columns, to avoid infinite loops.
- Inactive events (`active = false`) are removed from Google but kept in Lembra.

### Google OAuth details

- Scope: `https://www.googleapis.com/auth/calendar.events` only.
- Login requests offline access (`access_type=offline`, `prompt=consent`) so a refresh token is issued.
- Supabase only exposes the provider refresh token at sign-in time, so the frontend must capture it on the `SIGNED_IN` event and send it to the `store-google-token` function, which stores it with the service role.
- The OAuth app in Google Cloud must be set to **In production** (not "Testing"). In Testing mode, refresh tokens expire after 7 days and sync silently dies. Verification is not required for a single user, but Google will show an "unverified app" warning once at consent.
- If the refresh token is revoked or invalid, the app must show a visible "Reconnect Google Calendar" banner.

## 8. Authentication, privacy and security

### Access control (three layers)

1. **Google-only login.** The email provider is disabled. The only way in is Google.
2. **Email allowlist.** A `BEFORE INSERT` trigger on `auth.users` rejects any email not present in the `allowed_emails` table. Even if signups are technically open, nobody else can create an account.
3. **Row Level Security on every table.** Every table has `user_id`, and policies only allow `user_id = auth.uid()`. The anon role has no access to any table.

### Secrets and tokens

- The Supabase **anon key** is public by design and safe to ship in the frontend because RLS and the allowlist protect the data.
- The **service role key**, Google client secret, VAPID private key and cron secret live only in Supabase Edge Function secrets and GitHub Actions secrets. They never appear in the frontend or in git.
- `google_tokens` has RLS enabled with **no policies** and all privileges revoked from `anon` and `authenticated`. Only the service role can read it. Hardening option: keep the token in Supabase Vault and store only a reference.

### Data minimization

- Store amounts, categories and notes. **Never** store card numbers, IBANs, bank logins or national ID numbers.
- No analytics, no tracking scripts, no third-party fonts loaded from external CDNs (self-host fonts).
- Notes fields should not be encouraged for sensitive free text.

### Web security checklist

- HTTPS only (enforced by Cloudflare and Supabase).
- Set a strict Content Security Policy via Cloudflare Pages `_headers`.
- Validate inputs with a schema library (Zod) on the client and with database constraints (`check` constraints) on the server.
- Edge Functions verify the caller's JWT, or a shared `CRON_SECRET` header for scheduled calls.

## 9. Data model

The full SQL is in `supabase/migrations/0001_init.sql`. Summary:

| Table                | Purpose                                                       | Key columns                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allowed_emails`     | Allowlist for who can sign in.                                | `email`                                                                                                                                                                              |
| `user_settings`      | Per-user preferences.                                         | `timezone` (default `Europe/Lisbon`), `locale` (default `pt-PT`), `currency`, `push_enabled`, `google_calendar_id`                                                                   |
| `categories`         | Categories for appointments, bills and expenses.              | `kind` (`appointment`, `bill`, `expense`), `name`, `color`, `icon`                                                                                                                   |
| `events`             | Everything that has a date: medications, appointments, bills. | `type`, `title`, `category_id`, `starts_at`, `ends_at`, `all_day`, `timezone`, `rrule`, `reminder_minutes[]`, `dose`, `amount`, `group_id`, `active`, `google_event_id`, sync fields |
| `event_completions`  | Per-occurrence result: dose taken, bill paid, or skipped.     | `event_id`, `occurrence_at`, `status` (`done` or `skipped`), `completed_at`, `amount_paid`                                                                                           |
| `budgets`            | Monthly budgets: one per expense category, plus one overall.  | `category_id` (**nullable**; `null` = overall budget), `monthly_amount`                                                                                                              |
| `expenses`           | Spending records.                                             | `amount`, `category_id`, `spent_on`, `note`, `event_id` (link to the bill it came from), `completion_id` (optional, see below)                                                       |
| `push_subscriptions` | Web push endpoints per device.                                | `endpoint`, `p256dh`, `auth`                                                                                                                                                         |
| `push_sent`          | Prevents duplicate push for the same occurrence.              | `event_id`, `occurrence_at`                                                                                                                                                          |
| `sync_outbox`        | Queue of pending Google Calendar changes.                     | `event_id`, `action`, `attempts`, `last_error`                                                                                                                                       |
| `google_tokens`      | Google refresh token (service role only).                     | `user_id`, `refresh_token`                                                                                                                                                           |

And a view: `monthly_spend` (expenses grouped by month and category, `security_invoker` so RLS applies).

### Modeling decisions

- **One `events` table** for medications, appointments and bills. They share dates, recurrence, reminders and Google sync. A `type` column tells them apart.
- **One `event_completions` table** covers "taken", "paid" and "skipped". A recurring event has a completion row per occurrence, keyed by `(event_id, occurrence_at)`.
- **`group_id`** ties together the dose times of one medication (for example 08:00 and 20:00 of the same pill), so the UI can present them as one medication while each row maps to one Google event.
- **Budgets:** `category_id` is nullable. A row with `category_id = null` is the overall monthly budget, enforced by a partial unique index (one overall budget per user, one budget per category per user). Overall and per-category budgets are independent; the overall figure is not required to equal the sum of the categories.
- **Bill paid creates an expense.** When a bill occurrence is marked as paid, an expense is created with the amount paid (defaulting to the bill amount), the bill's expense category, the payment date, and a link back to the bill and the completion. Undoing "Paid" removes that expense. This should happen atomically, in a database function (RPC) or trigger, not as two separate client calls.
- **Money** is `numeric(12,2)` in the database. In the frontend, do arithmetic in integer cents and format with `Intl.NumberFormat`.
- **Time** is `timestamptz` in the database, with an explicit IANA `timezone` per event for correct recurrence across daylight saving changes.

## 10. Recurrence and time zones

- Recurrence rules are stored as standard RRULE strings (for example `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO,TH`, `FREQ=MONTHLY;BYMONTHDAY=5`). No `BYHOUR` in stored rules; times come from `starts_at`.
- All recurrence logic lives in one module, `src/lib/recurrence.ts`, with a twin for Edge Functions. It exposes:
  - `occurrencesBetween(event, from, to)` returns the concrete occurrences in a range.
  - `nextOccurrence(event, after)`.
- `rrule.js` is notoriously tricky with time zones. Use its `tzid` support and **unit-test across the Europe/Lisbon daylight saving changes** (last Sunday of March and October) to make sure a dose at 08:00 stays at 08:00 local time.
- The default time zone is `Europe/Lisbon` and is stored per user in `user_settings`.

## 11. UX and accessibility rules

These are requirements, not suggestions. The primary user is not a power user.

- **Base font 18px or larger.** Headings clearly larger. Support browser zoom without breaking layout.
- **Tap targets at least 48x48px**, with generous spacing.
- **High contrast** (WCAG AA minimum). Do not rely on color alone to convey meaning.
- **Very few screens.** Bottom navigation on mobile with at most 5 items: Today, Calendar, Money, Add, Settings.
- **Today screen first.** Lists only what matters today. Medication cards have a large "Taken" button.
- **Plain language.** No jargon. Verbs on buttons ("Save", "Mark as taken", "Mark as paid").
- **Forgiving.** Confirm destructive actions, offer undo after "Taken" and "Paid", never lose input on errors.
- **No hidden gestures** (no swipe-only actions).
- **Clear status.** Visible banners for: offline, Google sync failing, push permission denied.
- **Language.** pt-PT is the default. All UI text goes through an i18n layer from day one, so English can be supported too. pt-PT copy is written first; English is a translation.
- **Works offline for reading.** Cache the last known "today" data so the app opens without a connection. Writes require a connection in the MVP.

## 12. Repository structure

```
lembra/
  README.md
  AGENT_PROMPT.md
  package.json
  pnpm-lock.yaml
  vite.config.ts
  tsconfig.json
  index.html
  public/
    icons/                     PWA icons (192, 512, maskable)
    _headers                   security headers for Cloudflare Pages
  src/
    main.tsx
    app/                       router, providers, layout, guards
    features/
      today/
      medications/
      appointments/
      calendar/
      bills/
      budgets/
      expenses/
      settings/
    components/                shared UI (Button, Card, Modal, Field, ...)
    lib/
      supabase.ts              client + typed helpers
      recurrence.ts            all recurrence logic
      money.ts                 cents helpers and formatting
      dates.ts                 time zone helpers
      push.ts                  subscribe/unsubscribe web push
    i18n/                      pt-PT (default) and en strings
    types/
      database.ts              generated by the Supabase CLI
    sw.ts                      service worker (precache + push handler)
  supabase/
    config.toml
    migrations/
      0001_init.sql
    functions/
      _shared/                 CORS, auth check, Google client, rrule helpers
      store-google-token/
      calendar-sync/
      send-reminders/
  .github/
    workflows/
      ci.yml                   lint, typecheck, unit and browser tests
      backup.yml               opt-in private-repository pg_dump
  docs/
```

## 13. Setup guide

### Prerequisites

Node 22.12 or newer, pnpm 10.33.2, the Supabase CLI, Git, and a GitHub account. You also need your own accounts on Supabase, Google Cloud and Cloudflare for a deployment.

Use your own Supabase project and credentials throughout this guide. No accounts, allowed emails, OAuth credentials or live deployment are included. Medications, private photos, history, appointments, bills, tasks, expenses, budgets and the combined calendar are implemented. Calendar and push workers must be deployed and configured for your project, then verified on your phone. The local development server also registers the notification service worker; refresh after startup before testing push.

### Step 1: Supabase project

1. Create a project in an EU region.
2. Note the project URL, anon key and service role key (Settings, API).
3. Under Authentication, Providers: **disable Email**, **enable Google** (client ID and secret come from step 2).
4. Under Authentication, URL Configuration: set the Site URL to the production URL, and add `http://localhost:5173` to redirect URLs for development.

### Step 2: Google Cloud

1. Create a project and enable the **Google Calendar API**.
2. OAuth consent screen: type External, add the scope `.../auth/calendar.events`.
3. **Publish the app to "In production".** Do not leave it in Testing.
4. Create an OAuth client (Web application). Add the Supabase callback URL as an authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Paste the client ID and secret into the Supabase Google provider.

### Step 3: Database

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Apply all migrations, currently `0001` through `0010`, together using `supabase db push`. The later migrations add ownership hardening, atomic medication groups, private photos, reminder delivery leases, Calendar worker locking, Vault-backed schedules, daily care, tasks, recurrence and completion history. Refresh the generated types after a schema change:

```bash
pnpm dlx supabase gen types typescript --linked > src/types/database.ts
pnpm typecheck
```

Then, in the Supabase SQL editor, add the allowed emails (lowercase):

```sql
insert into public.allowed_emails (email) values
  ('mom@example.com'),
  ('you@example.com');
```

Without this step nobody can log in.

### Step 4: Frontend

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local   # fill in values from section 14
pnpm dev
```

Copy `.env.example` only if `.env.local` does not exist, and fill it with your own project URL, publishable key and public VAPID key. The client also accepts the legacy `VITE_SUPABASE_ANON_KEY`. Keep server secrets out of all `VITE_` variables.

Add `http://localhost:5173/auth/callback` to Supabase's permitted auth redirects. Configure Edge secrets and deploy the functions:

```bash
pnpm dlx supabase secrets set APP_ORIGIN=http://localhost:5173
pnpm dlx supabase functions deploy store-google-token
pnpm dlx supabase functions deploy calendar-sync
pnpm dlx supabase functions deploy send-reminders
pnpm dlx supabase functions deploy test-reminder
```

Set `APP_ORIGIN` to the exact production origin when deploying the frontend. Functions verify user JWTs and the allowlist themselves; scheduled workers also accept `x-cron-secret`. Gateway legacy JWT verification is disabled in `config.toml` to support current signing keys. The push function's import map supplies a small Deno compatibility shim for the same tested recurrence module used by the browser.

### Step 5: Edge Functions

```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com \
  CRON_SECRET=...
supabase functions deploy store-google-token
supabase functions deploy calendar-sync
supabase functions deploy send-reminders
supabase functions deploy test-reminder
```

Generate VAPID keys with `npx web-push generate-vapid-keys`.

### Step 6: Schedules

Migration `0006_reminder_schedules.sql` enables the extensions and schedules both workers every minute. In Supabase Vault configure `lembra_function_origin` as the Supabase project URL and `lembra_cron_secret` as the same value as the Edge `CRON_SECRET`. Never put the secret in a migration. Without these Vault entries the dispatcher does not send requests. Configure both entries for your own deployment and verify the scheduled worker calls succeed.

### Step 7: Phone setup for Mom (do this together, in person)

1. Open the app URL in Chrome on Android, sign in with Google, accept the "unverified app" warning once.
2. Install it to the home screen.
3. Allow notifications for the app.
4. Make sure the **Google Calendar app** is installed, signed in, and has notifications allowed and battery optimization disabled.
5. Create a test medication for 2 minutes from now and confirm both the Google Calendar notification and the Lembra push arrive.

## 14. Environment variables and secrets

### Frontend (`.env.local`, safe to expose)

| Name                            | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Project URL.                                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public publishable key (the legacy anon key is also accepted). |
| `VITE_VAPID_PUBLIC_KEY`         | Public VAPID key for push subscription.                        |

Commit a `.env.example` with empty values. Never commit `.env.local`.

### Edge Function secrets (never in git or frontend)

| Name                                                     | Description                                   |
| -------------------------------------------------------- | --------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                              | Provided automatically inside Edge Functions. |
| `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`            | For refreshing Google access tokens.          |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Web push.                                     |
| `CRON_SECRET`                                            | Shared secret for scheduled invocations.      |

### Private backup repository configuration

| Name                    | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `SUPABASE_DB_URL`       | Database connection string used by the private backup job. |
| `BACKUP_ENCRYPTION_KEY` | Passphrase to encrypt dumps.                               |

Set the repository variable `ENABLE_DATABASE_BACKUPS=true` only in the private repository that owns your production backups. The workflow skips every public repository, even if secrets are present.

## 15. Deployment

- **Frontend:** connect the GitHub repo to Cloudflare Pages. Build command `pnpm build`, output directory `dist`. Set the three `VITE_` variables. Add a `_redirects` rule so all routes serve `index.html` (single-page app).
- **Database and functions:** deploy with the Supabase CLI (`supabase db push`, `supabase functions deploy`). Migrations live in git and are the only way schema changes are made.
- **Environments:** one production project is enough. For safer development, optionally create a second free Supabase project for staging.

## 16. Backups and recovery

The Supabase free tier does not provide point-in-time recovery, so backups are our responsibility.

- Copy `.github/workflows/backup.yml` into a dedicated private repository, configure `SUPABASE_DB_URL` and `BACKUP_ENCRYPTION_KEY` there, and set `ENABLE_DATABASE_BACKUPS=true`. It runs weekly or on manual dispatch, dumps the `public` schema, encrypts it with GPG AES-256 and stores a private Actions artifact. It is disabled in public repositories and unconfigured forks.
- Test a restore at least once into a scratch Supabase project or local Postgres.
- Free projects pause after about a week of inactivity. Daily use and the weekly backup connection should prevent this, but check the dashboard occasionally.
- Settings includes a JSON data export, with pagination so history is not silently truncated. Packaging image files are not embedded in the export.
- The backup workflow is implemented, but needs both GitHub secrets and a successful restore exercise before it can be considered operational. It encrypts the public-schema dump with GPG AES-256. Supabase Auth identities and Storage image contents need separate recovery planning.

## 17. Roadmap

The checkboxes below describe source implementation. Every deployment still needs its own infrastructure setup and real-device acceptance checks.

### Phase 0: Foundation

- [x] Repo, Vite + React + TypeScript + Tailwind, lint and format
- [x] PWA manifest, icons and service worker
- [x] Database migrations `0001` through `0010` provided
- [x] Database types included; regenerate them for schema changes
- [x] Google login, allowlist, protected routes and sign out (configure provider, allowlist and redirects per deployment)
- [x] i18n scaffold (pt-PT default, en secondary)
- [x] Layout with bottom navigation, base components, accessibility defaults
- [x] CI (lint, typecheck, tests)

### Phase 1: Medications and reminders

- [x] Recurrence module with unit tests (including daylight saving)
- [x] Medication CRUD (name, dose, times, days, active toggle; hosted acceptance pending)
- [x] Today screen with "Taken" and "Skip" plus undo (hosted acceptance pending)
- [x] Medication history view (last 30 days)
- [x] Private medication packaging photos, search and grouped management
- [x] Web push: subscribe, `send-reminders` function, cron job (phone delivery pending)
- [x] Google Calendar: token capture, `calendar-sync`, outbox, cron job (real notification acceptance pending)
- [x] Sync status and reconnect banners

### Phase 2: Appointments and calendar

- [x] Appointment CRUD with categories
- [x] Custom category creation in Settings
- [x] Calendar views (month, week, agenda) combining all event types
- [x] Reminder options per appointment (defaults: 1 day and 1 hour before)

### Phase 3: Bills

- [x] Bill CRUD with amount and recurrence (defaults: reminders 3 days before and on the due day)
- [x] "Paid" action per occurrence, with optional amount paid, and undo
- [x] Upcoming and overdue bills on the Today screen (next 7 days; recurring arrears limited to 90 days)

### Phase 4: Budgets and expenses

- [x] Expense quick-add, edit/delete and monthly list
- [x] Budgets: per category **and** overall monthly budget, progress bars for both
- [x] Marking a bill as paid creates the matching expense (atomic, undoable)
- [x] Monthly summary, category breakdown, six-month totals and cumulative monthly spending graphs, with accessible data tables

### Phase 5: Polish and hardening

- [x] Offline read cache for Today
- [x] Data export
- [ ] Backup workflow verified with a test restore
- [x] Security headers and CSP (permits private Supabase photos, no external fonts or trackers)
- [ ] Accessibility pass (screen zoom, contrast, keyboard)

### Beyond the MVP

- [ ] AI features (scope to be defined)
- [x] Optional read-only family view with selective, revocable access
- [x] Optional unrecorded-dose follow-ups, snoozes and refill reminders
- [x] Yearly spending view with monthly totals and month drill-down
- [ ] Dedicated Google calendar

### Usability redesign (October 2026)

The public root shows a branded introduction when signed out, while signed-in users open Today. `/welcome` always opens the public homepage. Material UI supplies the shared buttons, fields, dialogs, alerts, drawers and mobile navigation, with a custom green theme and local system fonts.

All app pages share the new layout. Medications default to active items; bills default to unpaid items. Search is available for medications, appointments, bills, history and the calendar. Common filters use one-tap chips; category, amount, recurrence and sorting controls are available under “More filters”, with removable chips for applied selections. Medication and appointment statistics, bill totals, and calendar counts follow the selection. History offers 7/14/30-day recorded-dose charts by day and medication. Money keeps the full-month budget overview separate from filtered expense totals, averages and charts. Appointment and bill forms offer reminder choices and collapse optional details. Today adds a reminder setup checklist and unpaid bills due in the next seven days, including overdue one-off bills and recurring occurrences from the previous 90 days. Paying a bill still uses the existing atomic database operation.

All dropdowns use the shared Material UI `SelectField` component, including form choices, filters, language settings and the Money year picker. Menus retain empty and disabled options, support keyboard selection, and use 48px minimum option heights with a bounded scrollable menu.

Pages load on demand. The static hosting CSP permits inline styles because Emotion generates styles at runtime and Material UI uses inline positioning; script restrictions remain in place. No external fonts or analytics were added.

The app has no top text bar. The sidebar uses the compact logo without the tagline and reduced spacing, keeping 48px navigation targets and no independent scrollbar. Desktop windows at 700px height or less use the bottom navigation and menu drawer so all destinations remain accessible.

Money offers Month and Year views with one button showing the selected period. It opens a month grid with a year selector, a full-year action and a Current month shortcut. Historical and future months, and the yearly view, are read-only. Manual expense entry and edits accept dates in the current Lisbon calendar month only; deletion and budget editing are available in the current-month view. This is an application workflow restriction, not a new database permission. Bill payment and undo retain their existing behavior. Yearly totals include every recorded expense in that year, with paginated loading; filters apply to the expense list, category breakdown and twelve-month chart, while the overview retains the full period totals. Each month in the yearly chart has a button to open its details. Budgets are ongoing monthly limits, without historical snapshots, so budget comparisons appear only in the current month.

### Daily care improvements (October 2026)

Today leads with the next pending dose or appointment, falls back to the next unpaid bill, and keeps completed doses collapsed with undo. Appointment and calendar links open the exact occurrence. Bills can be paid directly from Today using the atomic payment operation. Empty-day messages are suppressed when unpaid bills or refills need attention.

Medication forms include reminder presets, an every-day shortcut, field-specific validation and a schedule preview. Optional package run-out dates generate one refill reminder per medication group at 09:00 local time, the chosen number of calendar days before the estimated date. Update that estimate after buying a new package. Refill reminders, follow-ups and snoozes use Lembra push; Google Calendar continues to provide the independent primary dose reminders. Follow-ups are off by default and offer 15, 30 or 60 minutes after a scheduled dose. Any taken or skipped record suppresses dose follow-ups. Snoozes require enabled device notifications and delay Lembra reminders by ten minutes, without changing the prescribed schedule or Google Calendar alarms. Duplicate snooze/follow-up sends at the same time are suppressed. Reminder setup includes install instructions, Android checks and an authenticated device-specific push test. A successful API send is not labelled confirmed until the user says the notification appeared on that device.

Stopping or resuming a medication is available directly from the medication list and keeps its history. History separates scheduled time from recorded time, supports correcting or removing records, and allows recording currently scheduled past doses within the last 30 calendar days. Past-dose entry uses the current schedule; it does not reconstruct earlier prescriptions.

Appointments display notes, preparation, directions and duration. Recurring appointment edits and deletions offer one occurrence or the whole series. A single change atomically excludes the original occurrence and creates a detached replacement when needed; exclusions also sync to Google Calendar. Appointment duration no longer limits the series. Money explicitly labels budget remaining, displays unpaid bills separately for the selected month, and offers expense repeats and recent category shortcuts. Shortcuts fill a new form and never save automatically.

Family sharing is off by default. Settings lets the owner select medications, appointments and/or bills for an approved Google email. A relative signs in with Google and opens Family view. The administrator must first add the relative's email to `allowed_emails`; sharing never opens public signup or sends an invitation email. Settings can revoke access or change the selected areas by saving the same email again. The family RPC returns only active event titles, schedules, medication dose labels, bill amounts and recent completion states. It excludes notes, locations, photographs, expenses, budgets, tokens and internal sync metadata. Existing owner-only RLS policies are unchanged. Family data is not persisted in the offline cache and refreshes while the view is open.

To activate these features on an existing installation:

```bash
supabase db push
supabase functions deploy calendar-sync
supabase functions deploy send-reminders
supabase functions deploy test-reminder
```

Then publish the updated frontend through the your Cloudflare Pages deployment. Migration `0007_daily_care.sql` adds medication options, appointment exclusions, owner-scoped snoozes and selective family sharing. No new service or secret is required. Until the migration is applied, the frontend keeps ordinary medication, appointment, bill and money flows usable; optional features show an activation message, single-occurrence changes and additional reminders are disabled, and data export tolerates absent optional tables. Complete an actual Android test with Lembra closed, verify a Google Calendar alarm, and confirm a Lembra test notification. Local mocked browser tests cannot establish real phone delivery.

## 18. Testing

- **Unit tests (Vitest):** `recurrence.ts` (daily, weekly, monthly, daylight saving transitions, month-end edge cases), `money.ts` (cents math and rounding), budget progress calculations (per category and overall).
- **Database tests:** verify RLS by attempting cross-user reads and writes, verify the allowlist trigger rejects unknown emails, verify the "bill paid creates expense" function (creates one expense, is idempotent, and undo removes it).
- **Function tests:** the Google payload builder (event to Google event body) as a pure function, with fixtures.
- **Manual acceptance:** the phone checklist in section 13, step 7, after every release that touches reminders.
- **CI:** lint, typecheck, unit tests, production build and mocked browser tests on every push and pull request.

The suite executes application migrations `0001` through `0005` and `0007` through `0010` using embedded PostgreSQL (PGlite), with Supabase Auth and Storage roles/helpers stubbed. The extension-backed scheduler requires verification against your own Supabase project. Tests cover ownership, atomic edits, private photos, paid-bill expense updates and undo, medication options, snooze ownership, appointment exclusions and selective family sharing with revocation. Browser checks use synthetic data and a fictional, mocked Supabase backend: `pnpm exec playwright install chromium`, then `pnpm test:e2e`. Playwright starts its own server on port 5174 with test-only environment values, so no production credentials or `.env.local` are required for tests. These checks complement, rather than replace, Android acceptance testing.

## 19. Risks and known limitations

| Risk                                                            | Impact                                         | Mitigation                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Google refresh token expires or is revoked                      | Calendar sync stops silently                   | Sync error state in UI, "Reconnect" banner, OAuth app set to In production                      |
| Web push is unreliable on some Android devices (battery savers) | Missed push                                    | Google Calendar layer is primary; setup checklist disables battery optimization                 |
| Supabase free project pauses                                    | App unavailable                                | Daily use, weekly backup connection, dashboard check                                            |
| RLS misconfigured                                               | Data exposure                                  | RLS on every table, policies generated by one loop, tests for cross-user access, no anon grants |
| `rrule.js` time zone bugs                                       | Reminders off by an hour after daylight saving | Dedicated tests, single recurrence module                                                       |
| Free tier limits change                                         | Unexpected cost or outage                      | Keep the schema portable (plain Postgres) and backups current                                   |
| Only one dev (me)                                               | Bus factor                                     | Keep the stack boring, document decisions here                                                  |

## 20. Decision log

| Decision                                                                 | Reason                                                                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PWA instead of native app                                                | One codebase for Android and PC, no store distribution                                                                                                           |
| Supabase instead of custom backend                                       | Free managed Postgres, auth and cron; no server to run                                                                                                           |
| Google-only login plus email allowlist                                   | No passwords, and only approved people can enter                                                                                                                 |
| One-way sync to Google Calendar                                          | Avoids two-way sync complexity; Google is just the notification layer                                                                                            |
| Primary calendar with `calendar.events` scope                            | Simplest reliable start; dedicated calendar can come later                                                                                                       |
| One event row per dose time, grouped by `group_id`                       | 1:1 mapping to Google events, no `BYHOUR` dependency                                                                                                             |
| `event_completions` shared by medications and bills                      | One mechanism for "taken", "paid" and "skipped"                                                                                                                  |
| Outbox pattern for sync                                                  | Retries and failure visibility without coupling to the frontend                                                                                                  |
| Money as `numeric(12,2)`, cents in the frontend                          | Avoid floating point errors                                                                                                                                      |
| React over Svelte                                                        | Ecosystem size and documentation                                                                                                                                 |
| Default UI language is pt-PT                                             | Mom's language; English stays available via i18n                                                                                                                 |
| Default reminder lead times fixed (section 6)                            | Sensible starting point, overridable per item                                                                                                                    |
| Marking a bill as paid creates an expense                                | Avoids double entry; single action for the user                                                                                                                  |
| Both per-category and overall budgets                                    | Mom wants both views; `budgets.category_id` is nullable                                                                                                          |
| AI features deferred past the MVP                                        | Keep the MVP small and reliable; revisit later                                                                                                                   |
| Supabase publishable key environment variable                            | Matches the supplied project configuration; public keys remain protected by RLS                                                                                  |
| Node 22 and pnpm 10                                                      | Reproducible local and CI tooling                                                                                                                                |
| Separate ownership hardening migration                                   | Cross-row references must belong to the same user, and Google metadata is service-only                                                                           |
| RRULE uses a floating UTC wall clock with explicit event-zone conversion | rrule 2.8 named-zone conversion depends on the host timezone; explicit conversion preserves Lisbon dose times on other devices                                   |
| Nonexistent spring-forward dose times are skipped                        | Avoid silently moving a configured time; the form rejects nonexistent start times                                                                                |
| Atomic medication-group RPCs                                             | Multiple dose times save or delete together under RLS; unchanged times retain event IDs and completion history                                                   |
| Account-scoped offline read cache                                        | Store the last known medications and daily completions locally; clear cached health data on sign-out                                                             |
| Embedded PostgreSQL in tests                                             | Exercise migrations and RLS locally without Docker; Supabase Auth itself still needs hosted acceptance tests                                                     |
| Todoist-inspired warm sidebar and task hierarchy                         | User-selected reference, adapted for Portuguese-first copy, 18px text and large actions, without copying branding                                                |
| Compact spacing and contained dialogs                                    | User requested a smaller-feeling interface; retain 18px body text and 48px controls, reduce chrome, keep dialog headers visible and prevent closing during saves |
| Recorded-data dashboards                                                 | Spending trends use integer cents and paginated expenses; dose graphs count taken/skipped records, never infer adherence or missed doses from absent records     |
| Private packaging photos, resized and metadata stripped                  | Helps recognition without stock medication images or public health-data URLs                                                                                     |
| Service-only Calendar lock and stable Google IDs                         | Prevents concurrent/out-of-order writes; deletion jobs also cover first-insert races                                                                             |
| Push delivery keyed by occurrence, device and lead time                  | Independent device delivery and retryable claims; stale catch-up is limited to five minutes                                                                      |
| Selective family RPC for approved accounts                               | Preserve owner-only table RLS; share only chosen areas through an explicit projection; revocation removes access without emailing or opening signup              |
| Appointment duration separate from series end                            | Appointment end timestamps describe one appointment; medication end timestamps still cap recurrence                                                              |
| Optional dose follow-ups and snoozes                                     | Push-only secondary reminders, distinct delivery keys, no missed-dose inference, completion suppression and no changes to the medication schedule                |
| 90-day upcoming and recurring-bill list window                           | Keeps long-running schedules manageable; older one-off bills remain visible; older recurring debts need a later history view                                     |

## 21. Product decisions (formerly open questions)

All previously open questions have now been answered.

| Question                                         | Decision                                                                                                            | Impact                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Default UI language?                             | **pt-PT**                                                                                                           | `user_settings.locale` defaults to `pt-PT`; pt-PT copy written first.                                               |
| Default reminder lead times?                     | **Medications: at the exact time. Appointments: 1 day and 1 hour before. Bills: 3 days before and on the due day.** | Encoded as defaults (section 6).                                                                                    |
| Should marking a bill as paid create an expense? | **Yes**                                                                                                             | Moved from optional to planned in Phase 4; see section 9.                                                           |
| Budgets per category or one overall?             | **Both**                                                                                                            | `budgets.category_id` becomes nullable; UI shows both.                                                              |
| Should a relative ever get read-only access?     | **Possibly, in the future**                                                                                         | Not in the MVP. Would need a dedicated sharing design (RLS, invitation flow).                                       |
| Public signup, multi-tenant, billing?            | **Maybe in the future**                                                                                             | Out of scope now (see section 22). Nothing in the MVP should make it impossible: every table already has `user_id`. |
| AI features in the MVP?                          | **Not in the MVP, planned for the future**                                                                          | Scope to be defined; must respect the privacy principles (health and financial data).                               |

### Still to decide when the time comes

- What the AI features actually are, and which provider or model would process her data.
- Whether family sharing should ever expand beyond explicitly approved Google accounts.

## 22. Non-goals

For the current version (MVP):

- No bank account connections or automatic transaction import.
- No storing of card numbers, IBANs or passwords.
- No two-way Google Calendar sync.
- No native mobile apps.
- No public signup, multi-tenant product or billing (may be reconsidered in the future).
- No AI features in the MVP.

---

## License

Licensed under the [MIT License](LICENSE). Deployment accounts and private user data are not part of this repository.

Calendar navigation supports horizontal touch swipes in Month, Week and Agenda, with drag feedback and directional transitions confined to the calendar grid (respecting reduced-motion settings); event details below remain stationary. Mobile controls use three equal-width view buttons, previous/next arrows around the period label, and a full-width Today button. Focused browser checks cover 320px and 390px screens, month-end navigation, vertical scrolling, gesture feedback and touch target sizes.

### General tasks

Tasks have their own list at `/tasks` and can be added from Quick Add. A title is required; notes, date and time are optional. Date-only and timed tasks appear in Calendar, and Today shows unfinished tasks due today or earlier. Tasks can be edited, completed, reopened and deleted, and are included in the account data export. Portuguese and English are supported.

Apply `supabase/migrations/0008_tasks.sql` before using tasks. They use an owner-protected `tasks` table, independent of medication schedules, bill payments and appointment completions. Task reminders and Google Calendar sync are not implemented in this version. Flexible repetition is described below.

### Flexible repetition and calendar navigation

Appointments, bills, tasks and new expenses share optional recurrence controls. They support daily/weekly/monthly/yearly intervals, selected weekdays, multiple month dates, ordinal weekdays (including last), offsets from the last day of the month, seven-day month blocks, selected yearly months, and either an end date or occurrence count. The next five dates are shown before saving. Week blocks mean 1–7, 8–14, 15–21, 22–28 and 29–31; nonexistent numbered dates are skipped, while last-day rules include February 28 or 29 as appropriate. Schedules follow fixed dates, independent of completion time. Medication controls retain their existing behavior.

Recurring tasks use one completion per scheduled date, with independent completion and undo. Today retains overdue unfinished occurrences. The Tasks page also lists the next future occurrence and provides a collapsed Schedules section for editing a series or restoring skipped dates. Single-occurrence edits create an exception; future edits split the schedule atomically while retaining earlier completion records. Appointments and bills support the same edit scopes and occurrence skips. Future edits cannot cut through recorded completions or payments; select an occurrence after those records.

A recurring expense records the confirmed initial expense and creates a recurring bill for later payments. Those later payments only enter spending when confirmed. It does not create future spending automatically. The calendar period label opens a year/month picker with a direct date field and Today shortcut; month jumps preserve the day where possible and clamp it to the selected month's length. Month, Week and Agenda views remain selected when jumping.

Apply `supabase/migrations/0009_recurrence.sql` for task recurrence, completion history and atomic series/expense operations, then `0010_task_completion_history.sql` to preserve standalone completion records when a task is converted to a repeating schedule. Task push reminders and Google Calendar sync remain outside this feature; appointments and bills retain their existing reminder and sync channels.

### Home and task overviews

Today includes linked summaries of tasks needing attention, doses awaiting a record, unpaid bills, and monthly spending. Upcoming appointments and task occurrences appear in a seven-day preview; unscheduled tasks have their own preview. Reminder setup is available in Settings. The Tasks page uses shared search/filter controls, selection summaries, date/status labels, sorting and incremental loading.
