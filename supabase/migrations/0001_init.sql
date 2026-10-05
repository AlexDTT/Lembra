-- =====================================================================
-- Lembra: initial schema
-- Apply with: supabase db push
-- Notes:
--   * Every user-owned table has user_id and Row Level Security.
--   * The anon role gets no access to anything.
--   * Service-only tables (google_tokens, push_sent, sync_outbox,
--     allowed_emails) have RLS enabled and NO policies, so only the
--     service role can touch them.
--   * pg_cron / pg_net schedules live in a later migration (0002).
--
-- Changes vs. the first draft (see README, section 21):
--   * budgets.category_id is nullable: NULL = overall monthly budget.
--   * events.expense_category_id: which expense category a paid bill
--     is booked under (bill categories and expense categories differ).
--   * expenses.completion_id: links an expense to the "paid" completion
--     that created it, so undoing "Paid" removes the expense.
--   * mark_bill_paid(): marks a bill paid AND creates the expense atomically.
--   * Starter categories are seeded in pt-PT (default UI language).
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Access allowlist (only listed emails can ever create an account)
-- ---------------------------------------------------------------------

create table public.allowed_emails (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

create or replace function public.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails where email = lower(new.email)
  ) then
    raise exception 'Sign up is closed for this email address';
  end if;
  return new;
end;
$$;

create trigger enforce_allowed_email_before_insert
  before insert on auth.users
  for each row execute function public.enforce_allowed_email();

-- ---------------------------------------------------------------------
-- 3. Settings and categories
-- ---------------------------------------------------------------------

create table public.user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  timezone           text not null default 'Europe/Lisbon',
  locale             text not null default 'pt-PT',
  currency           text not null default 'EUR',
  push_enabled       boolean not null default true,
  google_calendar_id text not null default 'primary',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('appointment', 'bill', 'expense')),
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default '#64748b',
  icon       text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

create index categories_user_kind_idx on public.categories (user_id, kind);

-- ---------------------------------------------------------------------
-- 4. Events (medications, appointments, bills) and completions
-- ---------------------------------------------------------------------

create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  type                text not null check (type in ('medication', 'appointment', 'bill')),
  category_id         uuid references public.categories (id) on delete set null,
  expense_category_id uuid references public.categories (id) on delete set null,  -- bills: category of the expense created when paid
  group_id            uuid,                     -- ties dose times of one medication together
  title               text not null check (char_length(title) between 1 and 120),
  notes               text,
  location            text,
  dose                text,                     -- medications, e.g. "1 comprimido, 500 mg"
  amount              numeric(12, 2) check (amount is null or amount >= 0),  -- bills
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  all_day             boolean not null default false,
  timezone            text not null default 'Europe/Lisbon',
  rrule               text,                     -- e.g. FREQ=DAILY ; no BYHOUR, time comes from starts_at
  reminder_minutes    int[] not null default '{0}',
  active              boolean not null default true,
  google_event_id     text,
  google_synced_at    timestamptz,
  google_sync_error   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index events_user_starts_idx on public.events (user_id, starts_at);
create index events_user_type_idx   on public.events (user_id, type);
create index events_group_idx       on public.events (group_id) where group_id is not null;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  occurrence_at timestamptz not null,           -- the scheduled instant this refers to
  status        text not null default 'done' check (status in ('done', 'skipped')),
  completed_at  timestamptz not null default now(),
  amount_paid   numeric(12, 2) check (amount_paid is null or amount_paid >= 0),
  unique (event_id, occurrence_at)
);

create index event_completions_user_idx on public.event_completions (user_id, occurrence_at);

-- ---------------------------------------------------------------------
-- 5. Budgets and expenses
-- ---------------------------------------------------------------------

-- category_id NULL = the overall monthly budget.
create table public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  category_id    uuid references public.categories (id) on delete cascade,
  monthly_amount numeric(12, 2) not null check (monthly_amount >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- A plain UNIQUE (user_id, category_id) would allow many NULL rows,
-- so use two partial indexes instead.
create unique index budgets_user_category_uniq
  on public.budgets (user_id, category_id) where category_id is not null;
create unique index budgets_user_overall_uniq
  on public.budgets (user_id) where category_id is null;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  category_id   uuid references public.categories (id) on delete set null,
  event_id      uuid references public.events (id) on delete set null,             -- link to the bill it came from
  completion_id uuid unique references public.event_completions (id) on delete cascade,  -- deleting the "paid" completion removes the expense
  amount        numeric(12, 2) not null check (amount > 0),
  spent_on      date not null default current_date,
  note          text,
  created_at    timestamptz not null default now()
);

create index expenses_user_date_idx     on public.expenses (user_id, spent_on desc);
create index expenses_user_category_idx on public.expenses (user_id, category_id);

create view public.monthly_spend
with (security_invoker = true) as
select
  user_id,
  category_id,
  date_trunc('month', spent_on)::date as month,
  sum(amount)                          as total
from public.expenses
group by user_id, category_id, date_trunc('month', spent_on);

-- Overall spend per month is sum(total) over all categories for that month
-- (computed in the frontend or a second view when charts are built).

-- ---------------------------------------------------------------------
-- 5b. Marking a bill as paid creates the expense (atomic, undoable)
-- ---------------------------------------------------------------------
-- Runs as the caller (security invoker), so Row Level Security applies:
-- a user can only pay their own bills.
--
-- Undo "Paid": delete the completion row. The linked expense goes with it
-- (on delete cascade). Calling this again is safe (idempotent).

create or replace function public.mark_bill_paid(
  p_event_id      uuid,
  p_occurrence_at timestamptz,
  p_amount_paid   numeric default null,   -- defaults to the bill amount
  p_paid_on       date    default null    -- defaults to today in the event's time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event         public.events;
  v_amount        numeric(12, 2);
  v_paid_on       date;
  v_completion_id uuid;
begin
  select * into v_event
  from public.events
  where id = p_event_id and type = 'bill';

  if not found then
    raise exception 'Bill not found';
  end if;

  v_amount  := coalesce(p_amount_paid, v_event.amount);
  v_paid_on := coalesce(p_paid_on, (now() at time zone v_event.timezone)::date);

  insert into public.event_completions (user_id, event_id, occurrence_at, status, amount_paid)
  values (v_event.user_id, v_event.id, p_occurrence_at, 'done', v_amount)
  on conflict (event_id, occurrence_at) do update
    set status       = 'done',
        amount_paid  = excluded.amount_paid,
        completed_at = now()
  returning id into v_completion_id;

  if v_amount is not null and v_amount > 0 then
    insert into public.expenses
      (user_id, category_id, event_id, completion_id, amount, spent_on, note)
    values
      (v_event.user_id, v_event.expense_category_id, v_event.id,
       v_completion_id, v_amount, v_paid_on, v_event.title)
    on conflict (completion_id) do update
      set amount      = excluded.amount,
          spent_on    = excluded.spent_on,
          category_id = excluded.category_id;
  else
    delete from public.expenses where completion_id = v_completion_id;
  end if;

  return v_completion_id;
end;
$$;

revoke all on function public.mark_bill_paid(uuid, timestamptz, numeric, date) from public, anon;
grant execute on function public.mark_bill_paid(uuid, timestamptz, numeric, date) to authenticated;

-- If a paid occurrence is later changed to "skipped", remove its expense.
create or replace function public.remove_expense_when_not_done()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'done' then
    delete from public.expenses where completion_id = new.id;
  end if;
  return new;
end;
$$;

create trigger event_completions_remove_expense
  after update of status on public.event_completions
  for each row execute function public.remove_expense_when_not_done();

-- ---------------------------------------------------------------------
-- 6. Push and Google integration (service-side tables)
-- ---------------------------------------------------------------------

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.push_sent (
  event_id      uuid not null references public.events (id) on delete cascade,
  occurrence_at timestamptz not null,
  sent_at       timestamptz not null default now(),
  primary key (event_id, occurrence_at)
);

create table public.google_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,   -- hardening option: move to Supabase Vault and store a reference
  updated_at    timestamptz not null default now()
);

create table public.sync_outbox (
  id              bigint generated always as identity primary key,
  user_id         uuid not null,
  event_id        uuid not null,                 -- intentionally no FK: deletes must still be processable
  action          text not null check (action in ('upsert', 'delete')),
  google_event_id text,                          -- needed for deletes, the event row may be gone
  attempts        int  not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);

create index sync_outbox_pending_idx on public.sync_outbox (created_at) where processed_at is null;

-- Enqueue Google sync work whenever an event changes
create or replace function public.enqueue_event_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ignored text[] := array['google_event_id', 'google_synced_at', 'google_sync_error', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.google_event_id is not null then
      insert into public.sync_outbox (user_id, event_id, action, google_event_id)
      values (old.user_id, old.id, 'delete', old.google_event_id);
    end if;
    return old;
  end if;

  -- Skip updates that only touch google_* bookkeeping columns (prevents loops)
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - ignored) = (to_jsonb(old) - ignored) then
    return new;
  end if;

  insert into public.sync_outbox (user_id, event_id, action)
  values (new.user_id, new.id, 'upsert');
  return new;
end;
$$;

create trigger events_enqueue_sync
  after insert or update or delete on public.events
  for each row execute function public.enqueue_event_sync();

-- ---------------------------------------------------------------------
-- 7. Defaults for a new user (settings + starter categories, pt-PT)
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict do nothing;

  insert into public.categories (user_id, kind, name, color, sort_order)
  select new.id, v.kind, v.name, v.color, v.ord
  from (values
    ('appointment', 'Consulta médica', '#dc2626', 1),
    ('appointment', 'Dentista',        '#0891b2', 2),
    ('appointment', 'Família',         '#7c3aed', 3),
    ('appointment', 'Outro',           '#64748b', 4),
    ('bill',        'Serviços',        '#ca8a04', 1),  -- água, luz, gás, internet
    ('bill',        'Habitação',       '#2563eb', 2),
    ('bill',        'Seguros',         '#059669', 3),
    ('bill',        'Subscrições',     '#db2777', 4),
    ('bill',        'Outro',           '#64748b', 5),
    ('expense',     'Supermercado',    '#16a34a', 1),
    ('expense',     'Saúde',           '#dc2626', 2),
    ('expense',     'Transportes',     '#0284c7', 3),
    ('expense',     'Casa',            '#ca8a04', 4),
    ('expense',     'Lazer',           '#9333ea', 5),
    ('expense',     'Outro',           '#64748b', 6)
  ) as v(kind, name, color, ord)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings', 'categories', 'events', 'event_completions',
    'budgets', 'expenses', 'push_subscriptions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "%1$s_select_own" on public.%1$I for select to authenticated
         using (user_id = (select auth.uid()))', t);

    execute format(
      'create policy "%1$s_insert_own" on public.%1$I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);

    execute format(
      'create policy "%1$s_update_own" on public.%1$I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);

    execute format(
      'create policy "%1$s_delete_own" on public.%1$I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Service-only tables: RLS on, no policies, no client privileges
alter table public.google_tokens enable row level security;
alter table public.push_sent     enable row level security;
alter table public.sync_outbox   enable row level security;

revoke all on public.google_tokens from anon, authenticated;
revoke all on public.push_sent     from anon, authenticated;
revoke all on public.sync_outbox   from anon, authenticated;
revoke all on public.allowed_emails from anon, authenticated;

-- The anon role should never read or write anything in this app
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
