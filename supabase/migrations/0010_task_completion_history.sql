-- Preserve a completed standalone task when it becomes a repeating schedule.
create function public.preserve_task_completion() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.completed_at is not null and new.rrule is not null and old.rrule is null then
    insert into public.task_completions(user_id,task_id,occurrence_on,completed_at)
    values(old.user_id,old.id,coalesce(old.due_on,(old.completed_at at time zone 'Europe/Lisbon')::date),old.completed_at)
    on conflict(task_id,occurrence_on) do nothing;
    new.completed_at:=null;
  end if;
  return new;
end;
$$;
create trigger tasks_preserve_completion before update on public.tasks
for each row execute function public.preserve_task_completion();
