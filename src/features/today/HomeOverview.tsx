import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Card } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { useEvents } from '../events/queries';
import { useTasks } from '../tasks/queries';
import { useAttentionBills } from './bills';
import { dayBounds, localInstant, localTime } from '../../lib/dates';
import { shiftDay } from '../../lib/filters';
import { occurrencesBetween } from '../../lib/recurrence';
import { taskOccurrences } from '../tasks/model';
import { formatMoney, toCents } from '../../lib/money';
import { fetchAll } from '../../lib/pagination';
import { supabase } from '../../lib/supabase';

export function HomeOverview({
  day,
  dueTasks,
  pendingDoses,
  dosesReady,
  dosesLoading,
}: {
  day: string;
  dueTasks: number;
  pendingDoses: number;
  dosesReady: boolean;
  dosesLoading: boolean;
}) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const tasks = useTasks();
  const bills = useAttentionBills(day);
  const month = day.slice(0, 7);
  const nextMonth = `${Number(month.slice(0, 4)) + (month.endsWith('-12') ? 1 : 0)}-${String((Number(month.slice(5)) % 12) + 1).padStart(2, '0')}-01`;
  const expenses = useQuery({
    queryKey: ['expenses', session!.user.id, 'month', `${month}-01`],
    queryFn: ({ signal }) =>
      fetchAll((from, to) =>
        supabase
          .from('expenses')
          .select('*')
          .eq('user_id', session!.user.id)
          .gte('spent_on', `${month}-01`)
          .lt('spent_on', nextMonth)
          .order('spent_on', { ascending: false })
          .order('id')
          .range(from, to)
          .abortSignal(signal),
      ),
  });
  const cards: {
    label: string;
    value: string | number;
    hint: string;
    icon: IconName;
    to: string;
    unavailable?: boolean;
    loading?: boolean;
  }[] = [
    {
      label: t('homeTasks'),
      value: dueTasks,
      hint: t('homeTasksHelp'),
      icon: 'check',
      to: '/tasks',
      loading: tasks.isPending,
      unavailable: tasks.isPending || tasks.isError || !tasks.data?.available,
    },
    {
      label: t('homeDoses'),
      value: pendingDoses,
      hint: t('homeDosesHelp'),
      icon: 'pill',
      to: '/medications',
      unavailable: !dosesReady,
      loading: dosesLoading,
    },
    {
      label: t('homeBills'),
      value: bills.bills.length,
      hint: t('homeBillsHelp'),
      icon: 'receipt',
      to: '/bills',
      loading: bills.pending,
      unavailable: bills.pending || bills.error || bills.invalid,
    },
    {
      label: t('homeSpending'),
      value: formatMoney(
        (expenses.data || []).reduce(
          (sum, expense) => sum + toCents(expense.amount),
          0,
        ),
        locale,
      ),
      hint: new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Lisbon',
      }).format(dayBounds(day)[0]),
      icon: 'wallet',
      to: '/money',
      loading: expenses.isPending,
      unavailable: expenses.isPending || expenses.isError,
    },
  ];
  return (
    <section aria-label={t('homeOverview')} className="home-overview">
      <h2 className="section-heading">{t('homeOverview')}</h2>
      <div className="stat-grid">
        {cards.map((card) => (
          <Card className="stat-card home-stat" key={card.label}>
            <Link to={card.to}>
              <p>
                <Icon name={card.icon} />
                {card.label}
              </p>
              <strong>{card.unavailable ? '—' : card.value}</strong>
              <span>
                {card.unavailable
                  ? card.loading
                    ? t('loading')
                    : t('homeUnavailable')
                  : card.hint}
              </span>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function HomeUpcoming({ day }: { day: string }) {
  const { t, locale } = useI18n();
  const events = useEvents();
  const tasks = useTasks();
  const tomorrow = shiftDay(day, 1);
  const end = shiftDay(day, 7);
  const upcoming = [
    ...(events.data || [])
      .filter((event) => event.type === 'appointment')
      .flatMap((event) => {
        try {
          return occurrencesBetween(
            event,
            dayBounds(tomorrow)[0],
            dayBounds(end)[1],
          ).map((at) => ({
            key: `${event.id}:${at.toISOString()}`,
            title: event.title,
            at,
            time: event.all_day ? '' : localTime(at, event.timezone),
            icon: 'calendar' as const,
            to: `/items/${event.id}?at=${encodeURIComponent(at.toISOString())}`,
          }));
        } catch {
          return [];
        }
      }),
    ...taskOccurrences(
      tasks.data?.tasks || [],
      tasks.data?.completions || [],
      tomorrow,
      end,
    )
      .filter((task) => !task.completed_at)
      .map((task) => ({
        key: `${task.id}:${task.due_on}`,
        title: task.title,
        at: localInstant(task.due_on!, task.due_time?.slice(0, 5) || '00:00'),
        time: task.due_time?.slice(0, 5) || '',
        icon: 'check' as const,
        to: '/tasks',
      })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 4);
  const unscheduled = (tasks.data?.tasks || []).filter(
    (task) => !task.completed_at && !task.due_on,
  );
  return (
    <div className="home-planning">
      <Card className="home-upcoming">
        <header className="home-card-heading">
          <div>
            <h2 className="section-heading">
              <Icon name="calendar" />
              {t('homeUpcoming')}
            </h2>
            <p>{t('homeUpcomingHelp')}</p>
          </div>
          <Link to="/calendar">{t('homeSeeCalendar')}</Link>
        </header>
        {events.isPending || tasks.isPending ? (
          <p>{t('loading')}</p>
        ) : events.isError || tasks.isError ? (
          <p>{t('homeUnavailable')}</p>
        ) : upcoming.length ? (
          <ul className="home-agenda">
            {upcoming.map((item) => (
              <li key={item.key}>
                <Link to={item.to}>
                  <Icon name={item.icon} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {new Intl.DateTimeFormat(locale, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'Europe/Lisbon',
                      }).format(item.at)}
                      {item.time ? ` · ${item.time}` : ''}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('homeUpcomingEmpty')}</p>
        )}
      </Card>
      {unscheduled.length > 0 && (
        <Card className="home-unscheduled">
          <h2 className="section-heading">
            <Icon name="check" />
            {t('homeUnscheduled')}
            <span className="section-count">{unscheduled.length}</span>
          </h2>
          <p>{t('homeUnscheduledHelp')}</p>
          <ul className="home-agenda">
            {unscheduled.slice(0, 3).map((task) => (
              <li key={task.id}>
                <Link to="/tasks">
                  <span>
                    <strong>{task.title}</strong>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="button secondary" to="/tasks">
            {t('taskView')}
          </Link>
        </Card>
      )}
    </div>
  );
}
