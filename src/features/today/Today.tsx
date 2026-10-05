import { HomeOverview, HomeUpcoming } from './HomeOverview';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, EmptyState, Spinner } from '../../components/ui';
import { useOnline } from '../../lib/network';
import { dayBounds, localDate, localTime } from '../../lib/dates';
import { occurrencesBetween } from '../../lib/recurrence';
import { shiftDay } from '../../lib/filters';
import { useMedications } from '../medications/queries';
import { useCompletions, useCompletionAction } from './queries';
import type { EventRow } from '../../types/domain';
import { Icon } from '../../components/Icon';
import { MedicationPhoto } from '../medications/Photo';
import { BillAttention } from './BillAttention';
import { useAttentionBills } from './bills';
import { useEvents } from '../events/queries';
import { supabase } from '../../lib/supabase';
import { pushEnabled } from '../../lib/push';
import { useTasks } from '../tasks/queries';
import { TaskList } from '../tasks/Tasks';
import { tasksForDay, taskOccurrences } from '../tasks/model';
export function Today() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const online = useOnline();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [clock, setClock] = useState(() => new Date());
  const [snoozeError, setSnoozeError] = useState(false);
  const [snoozePending, setSnoozePending] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const day = localDate(clock);
  const medications = useMedications();
  const events = useEvents();
  const tasks = useTasks();
  const dueTasks = tasksForDay(
    tasks.data?.tasks || [],
    day,
    tasks.data?.completions || [],
  );
  const scheduledCompletedTasks = taskOccurrences(
    tasks.data?.tasks || [],
    tasks.data?.completions || [],
    [
      ...(tasks.data?.tasks || []).map((task) => task.due_on || day),
      ...(tasks.data?.completions || []).map((c) => c.occurrence_on),
    ].sort()[0] || day,
    day,
  ).filter(
    (task) =>
      task.completed_at && localDate(new Date(task.completed_at)) === day,
  );
  const completedTasks = [
    ...scheduledCompletedTasks,
    ...(tasks.data?.tasks || []).filter(
      (task) =>
        !task.rrule &&
        task.completed_at &&
        localDate(new Date(task.completed_at)) === day &&
        !scheduledCompletedTasks.some((item) => item.id === task.id),
    ),
  ];
  const attention = useAttentionBills(day);
  const completions = useCompletions(day);
  const action = useCompletionAction(day);
  const device = useQuery({
    queryKey: ['device-push', session!.user.id],
    queryFn: pushEnabled,
  });
  const snoozes = useQuery({
    queryKey: ['snoozes', session!.user.id, day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dose_snoozes')
        .select('*')
        .eq('user_id', session!.user.id)
        .gte('remind_at', dayBounds(day)[0].toISOString());
      if (error) throw error;
      return data;
    },
  });
  const [from, to] = dayBounds(day);
  const loading =
    medications.isPending || completions.isPending || events.isPending;
  const expand = (rows: EventRow[]) =>
    rows.map((event) => {
      try {
        return {
          items: occurrencesBetween(event, from, to).map((occurrence) => ({
            event,
            occurrence,
          })),
          invalid: false,
        };
      } catch {
        return { items: [], invalid: true };
      }
    });
  const doseExpansion = expand(medications.data || []);
  const appointmentExpansion = expand(
    (events.data || []).filter((e) => e.type === 'appointment'),
  );
  const invalid = [...doseExpansion, ...appointmentExpansion].some(
    (r) => r.invalid,
  );
  const doses = doseExpansion
    .flatMap((r) => r.items)
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
  const appointments = appointmentExpansion
    .flatMap((r) => r.items)
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
    .filter(
      (item) =>
        item.occurrence.getTime() +
          (item.event.ends_at
            ? new Date(item.event.ends_at).getTime() -
              new Date(item.event.starts_at).getTime()
            : 3600000) >=
        clock.getTime(),
    );
  const completionFor = (event: EventRow, occurrence: Date) =>
    completions.data?.find(
      (c) =>
        c.event_id === event.id &&
        new Date(c.occurrence_at).getTime() === occurrence.getTime(),
    );
  const pending = doses.filter(
    ({ event, occurrence }) => !completionFor(event, occurrence),
  );
  const completed = doses.filter(
    ({ event, occurrence }) => !!completionFor(event, occurrence),
  );
  const next =
    [
      ...pending.map((item) => ({ ...item, kind: 'medication' })),
      ...appointments.map((item) => ({ ...item, kind: 'appointment' })),
    ].sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())[0] ??
    (attention.bills[0] ? { ...attention.bills[0], kind: 'bill' } : undefined);
  const refills = [
    ...new Map(
      (medications.data || [])
        .filter(
          (e) =>
            e.active &&
            e.refill_on &&
            e.refill_on <= shiftDay(day, e.refill_reminder_days ?? 3),
        )
        .map((e) => [e.group_id || e.id, e]),
    ).values(),
  ];
  useEffect(() => {
    if (!loading && params.get('dose'))
      document
        .getElementById(`dose-${params.get('dose')}`)
        ?.scrollIntoView({ block: 'center' });
  }, [loading, params]);
  const renderDose = ({
    event,
    occurrence,
  }: {
    event: EventRow;
    occurrence: Date;
  }) => {
    const completion = completionFor(event, occurrence);
    const disabled =
      !online ||
      action.isPending ||
      completions.isPending ||
      completions.isError;
    const snooze = snoozes.data?.find(
      (s) =>
        s.event_id === event.id &&
        new Date(s.occurrence_at).getTime() === occurrence.getTime() &&
        new Date(s.remind_at) > clock,
    );
    return (
      <div
        id={`dose-${event.id}`}
        key={`${event.id}:${occurrence.toISOString()}`}
        className={params.get('dose') === event.id ? 'focused-item' : ''}
      >
        <Card className={`dose-card ${completion ? 'completed' : ''}`}>
          <div>
            {event.photo_path && <MedicationPhoto path={event.photo_path} />}
            <div className="dose-label">
              <Icon name="pill" />
              <span>{t('medications')}</span>
            </div>
            <p className="dose-time">{localTime(occurrence, event.timezone)}</p>
            <h3>{event.title}</h3>
            <p>{event.dose}</p>
            {completion ? (
              <p className="pill" role="status">
                {t(completion.status === 'done' ? 'done' : 'skipped')} ·{' '}
                {localTime(completion.completed_at, event.timezone)}
              </p>
            ) : occurrence < clock ? (
              <p className="pill">{t('notRecorded')}</p>
            ) : null}
            {snooze && (
              <p role="status">
                {t('snoozed')} {localTime(snooze.remind_at, event.timezone)}
              </p>
            )}
          </div>
          <div className="actions">
            {completion ? (
              <Button
                disabled={disabled}
                variant="secondary"
                onClick={() =>
                  action.mutate({
                    eventId: event.id,
                    occurrence: occurrence.toISOString(),
                    status: null,
                  })
                }
              >
                {t('undo')}
              </Button>
            ) : (
              <>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    action.mutate({
                      eventId: event.id,
                      occurrence: occurrence.toISOString(),
                      status: 'done',
                    })
                  }
                >
                  <Icon name="check" />
                  {t('taken')}
                </Button>
                <Button
                  disabled={disabled}
                  variant="secondary"
                  onClick={() =>
                    action.mutate({
                      eventId: event.id,
                      occurrence: occurrence.toISOString(),
                      status: 'skipped',
                    })
                  }
                >
                  {t('skip')}
                </Button>
                {occurrence <= clock &&
                  clock.getTime() - occurrence.getTime() < 23 * 3600000 && (
                    <Button
                      disabled={
                        disabled ||
                        snoozePending ||
                        !device.data ||
                        snoozes.isError ||
                        snoozes.isPending
                      }
                      title={!device.data ? t('snoozeUnavailable') : undefined}
                      variant="secondary"
                      onClick={() => {
                        setSnoozePending(true);
                        setSnoozeError(false);
                        void Promise.resolve(
                          supabase.from('dose_snoozes').upsert(
                            {
                              user_id: session!.user.id,
                              event_id: event.id,
                              occurrence_at: occurrence.toISOString(),
                              remind_at: new Date(
                                Date.now() + 10 * 60000,
                              ).toISOString(),
                            },
                            { onConflict: 'event_id,occurrence_at' },
                          ),
                        )
                          .then(async ({ error }) => {
                            if (error) throw error;
                            await client.invalidateQueries({
                              queryKey: ['snoozes', session!.user.id],
                            });
                          })
                          .catch(() => setSnoozeError(true))
                          .finally(() => setSnoozePending(false));
                      }}
                    >
                      {t('snooze')}
                    </Button>
                  )}
              </>
            )}
          </div>
        </Card>
      </div>
    );
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'full',
              timeZone: 'Europe/Lisbon',
            }).format(from)}
          </p>
          <h1>{t('today')}</h1>
        </div>
        <Link className="button" to="/add">
          <Icon name="plus" />
          {t('homeAdd')}
        </Link>
      </header>
      <HomeOverview
        day={day}
        dueTasks={dueTasks.length}
        pendingDoses={pending.length}
        dosesLoading={loading}
        dosesReady={
          !loading && !medications.isError && !completions.isError && !invalid
        }
      />
      {(medications.isError || events.isError || completions.isError) && (
        <Banner alert>
          {t('error')}
          <Button
            variant="secondary"
            onClick={() => {
              void medications.refetch();
              void events.refetch();
              void completions.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </Banner>
      )}
      {invalid && <Banner alert>{t('invalidSchedule')}</Banner>}
      {(action.isError || snoozeError) && (
        <Banner alert>{t('actionError')}</Banner>
      )}
      {loading && (online ? <Spinner /> : <Banner>{t('noCachedData')}</Banner>)}
      {!loading && next && (
        <Card className="next-action">
          <p className="eyebrow">
            {t('nextAction')} ·{' '}
            {localDate(next.occurrence, next.event.timezone) !== day &&
              `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: next.event.timezone }).format(next.occurrence)} · `}
            {localTime(next.occurrence, next.event.timezone)}
          </p>
          <h2>{next.event.title}</h2>
          {next.event.dose && <p>{next.event.dose}</p>}
          {next.kind === 'medication' ? (
            <Button
              disabled={!online || action.isPending || completions.isError}
              onClick={() =>
                action.mutate({
                  eventId: next.event.id,
                  occurrence: next.occurrence.toISOString(),
                  status: 'done',
                })
              }
            >
              {t('taken')}
            </Button>
          ) : (
            <Link
              className="button"
              to={`/items/${next.event.id}?at=${encodeURIComponent(next.occurrence.toISOString())}`}
            >
              {t('detailsTitle')}
            </Link>
          )}
        </Card>
      )}
      {appointments.length > 0 && (
        <section>
          <h2 className="section-heading">
            <Icon name="calendar" />
            {t('appointments')}
          </h2>
          {appointments.map(({ event, occurrence }) => (
            <Card key={`${event.id}:${occurrence.toISOString()}`}>
              <h3>{event.title}</h3>
              <p>
                {localTime(occurrence, event.timezone)}
                {event.location ? ` · ${event.location}` : ''}
              </p>
              <Link
                className="button secondary"
                to={`/items/${event.id}?at=${encodeURIComponent(occurrence.toISOString())}`}
              >
                {t('detailsTitle')}
              </Link>
            </Card>
          ))}
        </section>
      )}
      <BillAttention day={day} />
      {tasks.isError && (
        <Banner alert>
          {t('error')}
          <Button variant="secondary" onClick={() => void tasks.refetch()}>
            {t('retry')}
          </Button>
        </Banner>
      )}
      {dueTasks.length > 0 && (
        <section>
          <h2 className="section-heading">
            <Icon name="check" />
            {t('tasks')}{' '}
            <span className="section-count">{dueTasks.length}</span>
          </h2>
          <TaskList tasks={dueTasks} />
          <Link className="button secondary" to="/tasks">
            {t('taskView')}
          </Link>
        </section>
      )}
      {completedTasks.length > 0 && (
        <details className="completed-doses">
          <summary>
            {t('tasks')} · {t('taskCompleted')} ({completedTasks.length})
          </summary>
          <TaskList tasks={completedTasks} />
        </details>
      )}
      {pending.length > 0 && (
        <section>
          <h2 className="section-heading">
            <Icon name="pill" />
            {t('pending')}{' '}
            <span className="section-count">{pending.length}</span>
          </h2>
          {pending.map(renderDose)}
        </section>
      )}
      {!loading && doses.length > 0 && (
        <div className="today-summary">
          <Icon name="pill" />
          <strong>
            {
              doses.filter(
                ({ event, occurrence }) =>
                  completionFor(event, occurrence)?.status === 'done',
              ).length
            }{' '}
            / {doses.length}
          </strong>
          <span>{t('takenCount')}</span>
        </div>
      )}
      {completed.length > 0 && (
        <details
          className="completed-doses"
          open={
            completed.some((item) => item.event.id === params.get('dose')) ||
            undefined
          }
        >
          <summary>
            {t('completedDoses')} ({completed.length})
          </summary>
          {completed.map(renderDose)}
        </details>
      )}
      {!loading &&
        !attention.pending &&
        !attention.error &&
        !tasks.isPending &&
        !tasks.isError &&
        dueTasks.length === 0 &&
        attention.bills.length === 0 &&
        appointments.length === 0 &&
        refills.length === 0 &&
        pending.length === 0 &&
        doses.length > 0 && (
          <EmptyState title={t('allDone')} help={t('unrecordedHelp')} />
        )}
      {!loading &&
        !attention.pending &&
        !attention.error &&
        !invalid &&
        !medications.isError &&
        !events.isError &&
        !completions.isError &&
        !tasks.isPending &&
        !tasks.isError &&
        dueTasks.length === 0 &&
        attention.bills.length === 0 &&
        refills.length === 0 &&
        doses.length === 0 &&
        appointments.length === 0 && (
          <EmptyState title={t('noTasks')} help={t('noTasksHelp')}>
            <Link className="button" to="/add">
              {t('add')}
            </Link>
          </EmptyState>
        )}
      {refills.length > 0 && (
        <section>
          <h2>{t('refillTitle')}</h2>
          {refills.map((event) => (
            <Card key={event.id}>
              <h3>{event.title}</h3>
              <p>
                {t('refillDue')} · {event.refill_on}
              </p>
              <Link className="button secondary" to="/medications">
                {t('manage')}
              </Link>
            </Card>
          ))}
        </section>
      )}
      <HomeUpcoming day={day} />
      <div className="quick-links">
        <Link to="/medications/history">
          <Icon name="clock" />
          {t('history')}
        </Link>
        <Link to="/add/expense">
          <Icon name="wallet" />
          {t('expenseNew')}
        </Link>
      </div>
    </>
  );
}
