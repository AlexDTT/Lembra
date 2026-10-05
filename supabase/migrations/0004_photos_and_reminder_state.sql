-- Optional packaging photos stay private and are scoped to the owning account.
alter table public.events add column photo_path text;
alter table public.events add constraint events_photo_owner check (
  photo_path is null or (type = 'medication' and photo_path like user_id::text || '/%')
);
alter table public.events add constraint events_valid_end check (ends_at is null or ends_at >= starts_at);
alter table public.events add constraint events_valid_reminders check (
  cardinality(reminder_minutes) between 1 and 5 and 0 <= all(reminder_minutes) and 40320 >= all(reminder_minutes)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medication-photos', 'medication-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy medication_photos_select on storage.objects for select to authenticated
using (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy medication_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy medication_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.save_medication_with_photo(p_group_id uuid, p_rows jsonb, p_photo_path text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if p_photo_path is not null and p_photo_path not like (select auth.uid())::text || '/%' then
    raise exception 'Photo does not belong to this account';
  end if;
  perform public.save_medication_group(p_group_id, p_rows);
  update public.events set photo_path = p_photo_path where user_id = (select auth.uid()) and group_id = p_group_id and type = 'medication';
  return p_group_id;
end;
$$;
revoke all on function public.save_medication_with_photo(uuid, jsonb, text) from public, anon;
grant execute on function public.save_medication_with_photo(uuid, jsonb, text) to authenticated;

-- Each lead time and device has independent delivery state, with retryable leases.
create table public.reminder_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  occurrence_at timestamptz not null,
  lead_minutes int not null,
  sent_at timestamptz,
  lease_until timestamptz not null default now(),
  attempts int not null default 0,
  primary key (event_id, subscription_id, occurrence_at, lead_minutes)
);
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;
grant all on public.reminder_deliveries to service_role;

create table public.integration_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_connected boolean not null default false,
  google_last_success timestamptz,
  google_error text,
  push_last_success timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.integration_status enable row level security;
create policy integration_status_select on public.integration_status for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.integration_status from anon, authenticated;
grant select on public.integration_status to authenticated;
grant all on public.integration_status to service_role;
create trigger integration_status_updated before update on public.integration_status for each row execute function public.set_updated_at();

alter table public.sync_outbox add column available_at timestamptz not null default now();
alter table public.sync_outbox add column lease_until timestamptz;
create function public.claim_sync_jobs(p_user_id uuid default null, p_limit int default 25)
returns setof public.sync_outbox language sql security invoker set search_path = '' as $$
  update public.sync_outbox set lease_until = now() + interval '2 minutes'
  where id in (
    select id from public.sync_outbox where processed_at is null and available_at <= now()
      and (lease_until is null or lease_until < now()) and (p_user_id is null or user_id = p_user_id)
    order by id for update skip locked limit least(greatest(p_limit, 1), 50)
  ) returning *;
$$;
revoke all on function public.claim_sync_jobs(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_sync_jobs(uuid, int) to service_role;

create function public.claim_reminder(p_user_id uuid, p_event_id uuid, p_subscription_id uuid, p_occurrence_at timestamptz, p_lead_minutes int)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_claimed boolean;
begin
  insert into public.reminder_deliveries(user_id,event_id,subscription_id,occurrence_at,lead_minutes,lease_until,attempts)
  values(p_user_id,p_event_id,p_subscription_id,p_occurrence_at,p_lead_minutes,now()+interval '2 minutes',1)
  on conflict(event_id,subscription_id,occurrence_at,lead_minutes) do update
    set lease_until=now()+interval '2 minutes', attempts=public.reminder_deliveries.attempts+1
    where public.reminder_deliveries.sent_at is null and public.reminder_deliveries.lease_until < now()
  returning true into v_claimed;
  return coalesce(v_claimed,false);
end;
$$;
revoke all on function public.claim_reminder(uuid,uuid,uuid,timestamptz,int) from public, anon, authenticated;
grant execute on function public.claim_reminder(uuid,uuid,uuid,timestamptz,int) to service_role;

-- Prevent a client from silently changing a bill completion without booking its expense.
create or replace function public.mark_bill_paid(p_event_id uuid,p_occurrence_at timestamptz,p_amount_paid numeric default null,p_paid_on date default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_event public.events; v_amount numeric(12,2); v_paid_on date; v_completion_id uuid;
begin
  select * into v_event from public.events where id=p_event_id and type='bill' and user_id=(select auth.uid()) for update;
  if not found then raise exception 'Bill not found'; end if;
  v_amount := coalesce(p_amount_paid,v_event.amount);
  if v_amount is null or v_amount < 0 then raise exception 'Invalid amount'; end if;
  v_paid_on := coalesce(p_paid_on,(now() at time zone v_event.timezone)::date);
  insert into public.event_completions(user_id,event_id,occurrence_at,status,amount_paid)
  values(v_event.user_id,v_event.id,p_occurrence_at,'done',v_amount)
  on conflict(event_id,occurrence_at) do update set status='done',amount_paid=excluded.amount_paid,completed_at=now()
  returning id into v_completion_id;
  if v_amount > 0 then
    insert into public.expenses(user_id,category_id,event_id,completion_id,amount,spent_on,note)
    values(v_event.user_id,v_event.expense_category_id,v_event.id,v_completion_id,v_amount,v_paid_on,v_event.title)
    on conflict(completion_id) do update set amount=excluded.amount,spent_on=excluded.spent_on,category_id=excluded.category_id;
  else delete from public.expenses where completion_id=v_completion_id;
  end if;
  return v_completion_id;
end;
$$;
