-- Atomic group edits: the browser never leaves a medication half-saved.
create function public.save_medication_group(p_group_id uuid, p_rows jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_row jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_title text;
  v_dose text;
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_rule text;
  v_reminder integer;
  v_active boolean;
begin
  if v_user is null or p_group_id is null or jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 8 then
    raise exception 'Invalid medication group';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := coalesce((v_row->>'id')::uuid, gen_random_uuid());
    if v_id = any(v_ids) then raise exception 'Duplicate dose'; end if;
    if (v_row->>'id') is not null and not exists (
      select 1 from public.events where id = v_id and user_id = v_user and type = 'medication'
        and (group_id = p_group_id or (group_id is null and id = p_group_id))
    ) then raise exception 'Medication dose not found'; end if;
    v_title := btrim(v_row->>'title');
    v_dose := btrim(v_row->>'dose');
    v_timezone := v_row->>'timezone';
    v_start := (v_row->>'starts_at')::timestamptz;
    v_end := (v_row->>'ends_at')::timestamptz;
    v_rule := v_row->>'rrule';
    v_reminder := (v_row->>'reminder')::integer;
    v_active := (v_row->>'active')::boolean;
    if v_title is null or char_length(v_title) not between 1 and 120
       or v_dose is null or char_length(v_dose) not between 1 and 120
       or v_start is null or (v_end is not null and v_end < v_start)
       or v_timezone is null or not exists (select 1 from pg_timezone_names where name = v_timezone)
       or v_reminder is null or v_reminder not between 0 and 10080 or v_active is null
       or v_rule is null or not (v_rule = 'FREQ=DAILY' or v_rule ~ '^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU)){0,6}$') then
      raise exception 'Invalid medication values';
    end if;
    insert into public.events (id, user_id, type, group_id, title, dose, timezone, starts_at, ends_at, rrule, reminder_minutes, active)
    values (v_id, v_user, 'medication', p_group_id, v_title, v_dose, v_timezone, v_start, v_end, v_rule, array[v_reminder], v_active)
    on conflict (id) do update set group_id = excluded.group_id, title = excluded.title,
      dose = excluded.dose, timezone = excluded.timezone, starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, rrule = excluded.rrule,
      reminder_minutes = excluded.reminder_minutes, active = excluded.active;
    v_ids := array_append(v_ids, v_id);
  end loop;
  delete from public.events where user_id = v_user and type = 'medication'
    and (group_id = p_group_id or (group_id is null and id = p_group_id)) and not (id = any(v_ids));
  return p_group_id;
end;
$$;
revoke all on function public.save_medication_group(uuid, jsonb) from public, anon;
grant execute on function public.save_medication_group(uuid, jsonb) to authenticated;

create function public.delete_medication_group(p_group_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text, 0));
  delete from public.events where user_id = (select auth.uid()) and type = 'medication'
    and (group_id = p_group_id or (group_id is null and id = p_group_id));
end;
$$;
revoke all on function public.delete_medication_group(uuid) from public, anon;
grant execute on function public.delete_medication_group(uuid) to authenticated;
