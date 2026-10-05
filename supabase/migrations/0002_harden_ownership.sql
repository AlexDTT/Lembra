-- Preserve the initial migration and strengthen ownership of all foreign references.
alter table public.categories add constraint categories_user_id_id_unique unique (user_id, id);
alter table public.events add constraint events_user_id_id_unique unique (user_id, id);
alter table public.event_completions add constraint completions_user_id_id_unique unique (user_id, id);

alter table public.events
  add constraint events_category_owner foreign key (user_id, category_id) references public.categories (user_id, id),
  add constraint events_expense_category_owner foreign key (user_id, expense_category_id) references public.categories (user_id, id);
alter table public.event_completions
  add constraint completions_event_owner foreign key (user_id, event_id) references public.events (user_id, id);
alter table public.budgets
  add constraint budgets_category_owner foreign key (user_id, category_id) references public.categories (user_id, id);
alter table public.expenses
  add constraint expenses_category_owner foreign key (user_id, category_id) references public.categories (user_id, id),
  add constraint expenses_event_owner foreign key (user_id, event_id) references public.events (user_id, id),
  add constraint expenses_completion_owner foreign key (user_id, completion_id) references public.event_completions (user_id, id);

-- The sync worker owns Google metadata. Client writes must not forge external event identifiers.
create function public.protect_google_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.google_event_id is not null or new.google_synced_at is not null or new.google_sync_error is not null then
        raise exception 'Google metadata is service-only';
      end if;
    elsif new.google_event_id is distinct from old.google_event_id
       or new.google_synced_at is distinct from old.google_synced_at
       or new.google_sync_error is distinct from old.google_sync_error then
      raise exception 'Google metadata is service-only';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_protect_google_metadata before insert or update on public.events
for each row execute function public.protect_google_metadata();

-- Explicit grants work even when automatic Data API exposure is disabled.
grant select, insert, update, delete on public.user_settings, public.categories,
  public.events, public.event_completions, public.budgets, public.expenses,
  public.push_subscriptions to authenticated;
grant select on public.monthly_spend to authenticated;
grant all on public.google_tokens, public.sync_outbox, public.push_sent,
  public.allowed_emails to service_role;
grant usage, select on sequence public.sync_outbox_id_seq to service_role;
