# Implementation handoff

The implementation preserves Lembra's private, Portuguese-first purpose and large accessible controls.

## Implemented

- Calm desktop sidebar, five-item mobile navigation, SVG icons, daily progress, task filters and a four-option quick-add screen.
- Medication grouped CRUD, optional private packaging photos with resizing and metadata stripping, search and a 30-day completion history.
- Appointment CRUD, custom categories, bills with once/weekly/monthly recurrence, payment amount/date and undo. Payment and its expense are atomic.
- Expense CRUD, monthly totals, category breakdown, six-month spending and cumulative monthly graphs, overall and per-category budgets. Charts include accessible value tables and use paginated expense data.
- Medication history includes daily taken/skipped record counts over 14 days and 30-day totals. Missing records are not interpreted as missed doses or used to calculate medical adherence.
- Combined month, week and agenda calendar. Today includes today's appointments and bills alongside dose actions.
- Account-scoped offline reading of medications, events and daily completions, cleared at sign-out. Writes need internet.
- Settings includes language, category creation, paginated JSON export, Google reconnect/manual sync and device notification controls.
- Calendar outbox worker with stable IDs, retries, a global lease and race-safe delete jobs. Push worker uses the same recurrence module and separate claims per device/occurrence/lead time.
- Custom service-worker push display/click handling, exact-origin CORS, verified JWTs or cron secret, and Vault-backed one-minute schedules.
- Optional encrypted backup workflow, restricted to explicitly enabled private repositories; configure and test recovery in your own infrastructure.

## Deployment configuration

No hosted project, accounts or credentials are included. Create your own project, apply all migrations through `0010`, configure Google OAuth, Edge secrets and Vault-backed schedules, and verify worker authentication and delivery. Follow the [README setup guide](../README.md#13-setup-guide). Local environment files must remain ignored; only publishable frontend configuration belongs in `VITE_` variables.

## Still needed

- Cloudflare Pages deployment and its production URL. Set the frontend public variables, APP_ORIGIN, Supabase Site URL and allowed callback URL to match production.
- Google Calendar API enabled and OAuth consent In production. Google Cloud audience/consent settings cannot be managed using the Supabase account connection. Testing-mode refresh tokens expire after seven days.
- Install the production PWA on Android Chrome, enable notifications in Settings, and verify actual Calendar and push delivery with a near-future reminder. Continue existing alarms until this succeeds.
- Configure SUPABASE_DB_URL and BACKUP_ENCRYPTION_KEY in a private backup repository, set ENABLE_DATABASE_BACKUPS=true, run a backup, then rehearse recovery. Public-schema dumps do not contain Storage image files or a complete Auth recovery.

Appointment reminders now offer per-item choices, retaining the agreed defaults. Recurring bill lists cover the previous/next 90 days; one-off overdue bills remain visible. Today now surfaces unpaid overdue bills and bills due in the next seven days; payment is managed on the Bills screen. Comprehensive zoom/assistive-technology acceptance remains manual. These remaining items are not presented as completed in the README.

## Checks and cleanup

The focused checks cover integer cents, recurrence/DST, private ownership, atomic bill payment/undo, payload mapping and push endpoint safety. Desktop and 390px/320px browser smoke checks passed using mocked data. Deno encryption and recurrence startup were exercised without sending fabricated notifications.

Obsolete placeholder UI and empty barrel files were removed. All direct dependencies are used by the app, build, linting, typing or optional tests. Temporary browser screenshots and one-off administration helpers are not part of the product. Removed tracked scaffolding remains recoverable through Git history.

## Statistics and simpler filtering

Medications, appointments, bills, medication history, expenses and the calendar now have selection-based statistics and richer filters. Search and common one-tap views stay visible; advanced controls are collapsed behind “More filters”. Applied advanced filters can be removed individually. Clearing filters restores each page's default view. Bill overdue views automatically choose unpaid items. Expense charts and selection totals follow filters, while the monthly overview and budget progress retain all recorded monthly expenses. History supports 7, 14 and 30 calendar days and counts recorded taken/skipped doses only.

Focused validation covers combined expense filters, cent bounds, date windows across daylight saving and the selected history chart length. Browser checks use mocked data and verify quick filtering and the distinction between filtered totals and full-month totals.

Calendar navigation supports horizontal touch swipes in Month, Week and Agenda, with drag feedback and directional transitions confined to the calendar grid (respecting reduced-motion settings); event details below remain stationary. Mobile controls use three equal-width view buttons, previous/next arrows around the period label, and a full-width Today button. Focused browser checks cover 320px and 390px screens, month-end navigation, vertical scrolling, gesture feedback and touch target sizes.
