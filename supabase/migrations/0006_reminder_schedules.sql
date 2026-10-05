create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Configure the origin and cron secret in Vault, never in migration history.
create function public.dispatch_reminder_worker(p_function text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare origin text; secret text;
begin
  if p_function not in ('calendar-sync','send-reminders') then raise exception 'Invalid worker'; end if;
  select decrypted_secret into origin from vault.decrypted_secrets where name='lembra_function_origin';
  select decrypted_secret into secret from vault.decrypted_secrets where name='lembra_cron_secret';
  if origin is null or secret is null then return null; end if;
  return net.http_post(url:=origin || '/functions/v1/' || p_function,
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),
    body:='{}'::jsonb, timeout_milliseconds:=120000);
end;
$$;
revoke all on function public.dispatch_reminder_worker(text) from public, anon, authenticated;
grant execute on function public.dispatch_reminder_worker(text) to service_role;
select cron.schedule('lembra-calendar-sync','* * * * *', $$select public.dispatch_reminder_worker('calendar-sync');$$);
select cron.schedule('lembra-send-reminders','* * * * *', $$select public.dispatch_reminder_worker('send-reminders');$$);
