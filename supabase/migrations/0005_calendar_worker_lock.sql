-- Serialize Calendar writes to avoid out-of-order jobs and concurrent inserts.
create table public.worker_leases (
  name text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  owner uuid not null,
  lease_until timestamptz not null
);
alter table public.worker_leases enable row level security;
revoke all on public.worker_leases from anon, authenticated;
grant all on public.worker_leases to service_role;
create function public.claim_worker(p_name text, p_owner uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare claimed boolean;
begin
  insert into public.worker_leases(name,owner,lease_until) values(p_name,p_owner,now()+interval '3 minutes')
  on conflict(name) do update set owner=excluded.owner,lease_until=excluded.lease_until
  where public.worker_leases.lease_until < now()
  returning true into claimed;
  return coalesce(claimed,false);
end;
$$;
revoke all on function public.claim_worker(text,uuid) from public, anon, authenticated;
grant execute on function public.claim_worker(text,uuid) to service_role;

-- Queue every deletion, including a deletion racing a first Google insertion.
create or replace function public.enqueue_event_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare ignored text[] := array['google_event_id','google_synced_at','google_sync_error','updated_at'];
begin
  if tg_op = 'DELETE' then
    insert into public.sync_outbox(user_id,event_id,action,google_event_id)
    values(old.user_id,old.id,'delete',old.google_event_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and (to_jsonb(new)-ignored) = (to_jsonb(old)-ignored) then return new; end if;
  insert into public.sync_outbox(user_id,event_id,action) values(new.user_id,new.id,'upsert');
  return new;
end;
$$;
