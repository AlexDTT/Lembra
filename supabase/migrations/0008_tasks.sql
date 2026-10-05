-- General tasks can exist without a schedule and have their own completion state.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  due_on date,
  due_time time,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_time is null or due_on is not null)
);
create index tasks_user_due_idx on public.tasks(user_id, due_on);
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
alter table public.tasks enable row level security;
create policy tasks_select_own on public.tasks for select to authenticated using (user_id = (select auth.uid()));
create policy tasks_insert_own on public.tasks for insert to authenticated with check (user_id = (select auth.uid()));
create policy tasks_update_own on public.tasks for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tasks_delete_own on public.tasks for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
