alter table public.tasks
  add column rrule text,
  add column excluded_dates date[] not null default '{}',
  add constraint tasks_repeat_needs_date check (rrule is null or due_on is not null),
  add constraint tasks_owner_id unique(user_id,id);
create table public.task_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  occurrence_on date not null,
  completed_at timestamptz not null default now(),
  primary key(task_id,occurrence_on),
  foreign key(user_id,task_id) references public.tasks(user_id,id) on delete cascade
);
alter table public.task_completions enable row level security;
create policy task_completions_select on public.task_completions for select to authenticated using(user_id=(select auth.uid()));
create policy task_completions_insert on public.task_completions for insert to authenticated with check(user_id=(select auth.uid()));
create policy task_completions_update on public.task_completions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy task_completions_delete on public.task_completions for delete to authenticated using(user_id=(select auth.uid()));
revoke all on public.task_completions from anon;
grant select,insert,update,delete on public.task_completions to authenticated;
grant all on public.task_completions to service_role;

-- Atomically exclude, move, or split a task, without deleting its completion history.
create function public.edit_task_occurrence(p_task_id uuid,p_day date,p_scope text,p_input jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare old public.tasks; new_id uuid; cutoff text;
begin
  select * into old from public.tasks where id=p_task_id and user_id=(select auth.uid()) and rrule is not null for update;
  if not found or p_day is null or p_day<old.due_on or p_scope not in ('single','future') then raise exception 'Invalid task occurrence'; end if;
  if exists(select 1 from public.task_completions where task_id=old.id and occurrence_on>=p_day) and p_scope='future' then
    raise exception 'Choose an occurrence after completed records';
  end if;
  if p_scope='single' then
    update public.tasks set excluded_dates=array_append(excluded_dates,p_day) where id=old.id;
  else
    cutoff:=to_char(((p_day::timestamp at time zone 'Europe/Lisbon')-interval '1 second') at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"');
    update public.tasks set rrule=regexp_replace(regexp_replace(rrule,';?UNTIL=[^;]+','','g'),';?COUNT=[^;]+','','g')||';UNTIL='||cutoff where id=old.id;
  end if;
  if p_input is not null then
    insert into public.tasks(user_id,title,notes,due_on,due_time,rrule)
    values(old.user_id,btrim(p_input->>'title'),coalesce(p_input->>'notes',''),(p_input->>'due_on')::date,
      nullif(p_input->>'due_time','')::time,case when p_scope='future' then p_input->>'rrule' else null end)
    returning id into new_id;
  end if;
  return new_id;
end;
$$;
revoke all on function public.edit_task_occurrence(uuid,date,text,jsonb) from public,anon;
grant execute on function public.edit_task_occurrence(uuid,date,text,jsonb) to authenticated;

-- Appointments and bills share exceptions and safe series splitting.
create function public.edit_event_occurrence(p_event_id uuid,p_occurrence_at timestamptz,p_scope text,p_input jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare old public.events; new_id uuid; cutoff text;
begin
  select * into old from public.events where id=p_event_id and user_id=(select auth.uid()) and type in ('appointment','bill') and rrule is not null for update;
  if not found or p_occurrence_at is null or p_occurrence_at<old.starts_at or p_scope not in ('single','future') then raise exception 'Invalid event occurrence'; end if;
  if exists(select 1 from public.event_completions where event_id=old.id and
    (occurrence_at=p_occurrence_at or (p_scope='future' and occurrence_at>=p_occurrence_at))) then
    raise exception 'Choose an occurrence after completed records';
  end if;
  if p_scope='single' then
    update public.events set excluded_dates=array_append(excluded_dates,p_occurrence_at) where id=old.id;
  else
    cutoff:=to_char((p_occurrence_at-interval '1 second') at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"');
    update public.events set rrule=regexp_replace(regexp_replace(rrule,';?UNTIL=[^;]+','','g'),';?COUNT=[^;]+','','g')||';UNTIL='||cutoff where id=old.id;
  end if;
  if p_input is not null then
    insert into public.events(user_id,type,title,starts_at,ends_at,timezone,all_day,location,notes,category_id,expense_category_id,amount,reminder_minutes,rrule)
    values(old.user_id,old.type,btrim(p_input->>'title'),(p_input->>'starts_at')::timestamptz,(p_input->>'ends_at')::timestamptz,
      old.timezone,old.all_day,p_input->>'location',p_input->>'notes',nullif(p_input->>'category_id','')::uuid,
      nullif(p_input->>'expense_category_id','')::uuid,(p_input->>'amount')::numeric,
      array(select jsonb_array_elements_text(p_input->'reminder_minutes')::int),case when p_scope='future' then p_input->>'rrule' else null end)
    returning id into new_id;
  end if;
  return new_id;
end;
$$;
revoke all on function public.edit_event_occurrence(uuid,timestamptz,text,jsonb) from public,anon;
grant execute on function public.edit_event_occurrence(uuid,timestamptz,text,jsonb) to authenticated;

-- One transaction records the confirmed first expense and schedules later payments.
create function public.create_recurring_expense(p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare event_id uuid; starts timestamptz;
begin
  if p_input->>'rrule' is null or btrim(p_input->>'title')='' then raise exception 'Invalid recurring expense'; end if;
  starts:=(p_input->>'starts_at')::timestamptz;
  if starts is null or (starts at time zone 'Europe/Lisbon')::date<(p_input->>'spent_on')::date then raise exception 'Invalid schedule'; end if;
  insert into public.events(user_id,type,title,starts_at,all_day,amount,expense_category_id,notes,rrule,reminder_minutes)
  values((select auth.uid()),'bill',btrim(p_input->>'title'),starts,true,(p_input->>'amount')::numeric,
    nullif(p_input->>'category_id','')::uuid,p_input->>'note',p_input->>'rrule','{0}') returning id into event_id;
  if (starts at time zone 'Europe/Lisbon')::date=(p_input->>'spent_on')::date then
    perform public.mark_bill_paid(event_id,starts,(p_input->>'amount')::numeric,(p_input->>'spent_on')::date);
  else
    insert into public.expenses(user_id,amount,spent_on,note,category_id)
    values((select auth.uid()),(p_input->>'amount')::numeric,(p_input->>'spent_on')::date,p_input->>'note',nullif(p_input->>'category_id','')::uuid);
  end if;
  return event_id;
end;
$$;
revoke all on function public.create_recurring_expense(jsonb) from public,anon;
grant execute on function public.create_recurring_expense(jsonb) to authenticated;
