-- Optional medication reminders and appointment exceptions remain owner scoped.
alter table public.events
  add column refill_on date,
  add column refill_reminder_days integer not null default 3 check (refill_reminder_days between 0 and 30),
  add column followup_minutes integer check (followup_minutes in (15,30,60)),
  add column excluded_dates timestamptz[] not null default '{}';
alter table public.events add constraint medication_options_only check (
  type = 'medication' or (refill_on is null and followup_minutes is null)
);

create or replace function public.save_medication_with_photo(p_group_id uuid, p_rows jsonb, p_photo_path text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_row jsonb;
begin
  if p_photo_path is not null and p_photo_path not like (select auth.uid())::text || '/%' then
    raise exception 'Photo does not belong to this account';
  end if;
  perform public.save_medication_group(p_group_id, p_rows);
  v_row := p_rows->0;
  update public.events set photo_path = p_photo_path,
    refill_on = nullif(v_row->>'refill_on','')::date,
    refill_reminder_days = coalesce((v_row->>'refill_reminder_days')::int,3),
    followup_minutes = (v_row->>'followup_minutes')::int
  where user_id = (select auth.uid()) and group_id = p_group_id and type = 'medication';
  return p_group_id;
end;
$$;

create table public.dose_snoozes (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  occurrence_at timestamptz not null,
  remind_at timestamptz not null,
  primary key (event_id,occurrence_at),
  foreign key (user_id,event_id) references public.events(user_id,id) on delete cascade,
  check (remind_at >= occurrence_at and remind_at <= occurrence_at + interval '24 hours')
);
alter table public.dose_snoozes enable row level security;
create policy dose_snoozes_select on public.dose_snoozes for select to authenticated using (user_id = (select auth.uid()));
create policy dose_snoozes_insert on public.dose_snoozes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id=event_id and e.type='medication' and e.active)
);
create policy dose_snoozes_update on public.dose_snoozes for update to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id=event_id and e.type='medication' and e.active)
);
create policy dose_snoozes_delete on public.dose_snoozes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.dose_snoozes from anon;
grant select,insert,update,delete on public.dose_snoozes to authenticated;
grant all on public.dose_snoozes to service_role;

-- Single edits exclude the original from the series and insert a detached appointment atomically.
create function public.save_appointment_occurrence(p_event_id uuid,p_occurrence_at timestamptz,p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_event public.events; v_id uuid;
begin
  select * into v_event from public.events where id=p_event_id and user_id=(select auth.uid()) and type='appointment' and rrule is not null for update;
  if not found or p_occurrence_at is null or p_occurrence_at < v_event.starts_at or p_occurrence_at=any(v_event.excluded_dates) then raise exception 'Appointment not found'; end if;
  update public.events set excluded_dates=array_append(excluded_dates,p_occurrence_at) where id=v_event.id;
  if p_input is not null then
    insert into public.events(user_id,type,title,starts_at,ends_at,timezone,location,notes,category_id,reminder_minutes)
    values(v_event.user_id,'appointment',btrim(p_input->>'title'),(p_input->>'starts_at')::timestamptz,
      (p_input->>'ends_at')::timestamptz,v_event.timezone,p_input->>'location',p_input->>'notes',
      nullif(p_input->>'category_id','')::uuid,array(select jsonb_array_elements_text(p_input->'reminder_minutes')::int)) returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_appointment_occurrence(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.save_appointment_occurrence(uuid,timestamptz,jsonb) to authenticated;

-- Family readers receive only an explicit projection through an authenticated RPC.
-- Existing owner-only policies on events, completions and money are unchanged.
create table public.family_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (email=lower(email) and char_length(email) between 3 and 254),
  medications boolean not null default false,
  appointments boolean not null default false,
  bills boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,email),
  check (medications or appointments or bills)
);
alter table public.family_shares enable row level security;
create policy family_shares_select on public.family_shares for select to authenticated using (user_id=(select auth.uid()));
create policy family_shares_delete on public.family_shares for delete to authenticated using (user_id=(select auth.uid()));
revoke all on public.family_shares from anon,authenticated;
grant select,delete on public.family_shares to authenticated;
grant all on public.family_shares to service_role;
create function public.share_with_family(p_email text,p_medications boolean,p_appointments boolean,p_bills boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text := lower(btrim(p_email));
begin
  if (select auth.uid()) is null or not exists(select 1 from auth.users u join public.allowed_emails a on a.email=lower(u.email) where u.id=(select auth.uid()))
    or not exists(select 1 from public.allowed_emails where email=v_email)
    or exists(select 1 from auth.users where id=(select auth.uid()) and lower(email)=v_email)
    or p_medications is null or p_appointments is null or p_bills is null then raise exception 'Sharing unavailable for this account'; end if;
  insert into public.family_shares(user_id,email,medications,appointments,bills)
  values((select auth.uid()),v_email,p_medications,p_appointments,p_bills)
  on conflict(user_id,email) do update set medications=excluded.medications,appointments=excluded.appointments,bills=excluded.bills returning id into v_id;
  return v_id;
end;
$$;
create function public.read_family_view()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'owner',u.email,'medications',s.medications,'appointments',s.appointments,'bills',s.bills,
    'events',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'type',e.type,'title',e.title,'dose',e.dose,'starts_at',e.starts_at,'ends_at',e.ends_at,
      'timezone',e.timezone,'rrule',e.rrule,'active',e.active,'all_day',e.all_day,'excluded_dates',e.excluded_dates,
      'amount',case when e.type='bill' then e.amount else null end
    )),'[]'::jsonb) from public.events e where e.user_id=s.user_id and e.active and
      ((s.medications and e.type='medication') or (s.appointments and e.type='appointment') or (s.bills and e.type='bill'))),
    'completions',(select coalesce(jsonb_agg(jsonb_build_object('event_id',c.event_id,'occurrence_at',c.occurrence_at,'status',c.status)),'[]'::jsonb)
      from public.event_completions c join public.events e on e.id=c.event_id where c.user_id=s.user_id
      and c.occurrence_at between now()-interval '7 days' and now()+interval '7 days'
      and ((s.medications and e.type='medication') or (s.bills and e.type='bill')))
  )),'[]'::jsonb)
  from public.family_shares s join auth.users u on u.id=s.user_id
  where s.email=(select lower(email) from auth.users where id=(select auth.uid()));
$$;
revoke all on function public.share_with_family(text,boolean,boolean,boolean),public.read_family_view() from public,anon;
grant execute on function public.share_with_family(text,boolean,boolean,boolean),public.read_family_view() to authenticated;
