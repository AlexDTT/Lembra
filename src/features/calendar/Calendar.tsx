import { SectionNavigation } from '../../components/SectionNavigation';
import type { EventRow } from '../../types/domain';
import {
  FilterPanel,
  FilterSelect,
  Statistics,
  QuickFilters,
} from '../../components/Explore';
import { useExplore } from '../../i18n/explore';
import { matchesSearch, matchesCategory } from '../../lib/filters';
import { formatMoney, toCents } from '../../lib/money';
import { useMediaQuery, TextField } from '@mui/material';
import { Link } from 'react-router-dom';
import { useRef, useState, type TouchEvent } from 'react';
import {
  addDays,
  addMonths,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, EmptyState, Spinner } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { dayBounds, localDate, localTime } from '../../lib/dates';
import { occurrencesBetween } from '../../lib/recurrence';
import { useEvents, useCategories } from '../events/queries';

import { taskOccurrences } from '../tasks/model';
import { useTasks } from '../tasks/queries';
import { localInstant } from '../../lib/dates';
import { CalendarDatePicker } from './CalendarDatePicker';
export function Calendar() {
  const { t, locale } = useI18n();
  const query = useEvents();
  const tasks = useTasks();
  const explore = useExplore();
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [recurrence, setRecurrence] = useState('all');
  const mobile = useMediaQuery('(max-width:760px)');
  const [selected, setSelected] = useState(localDate());
  const [view, setView] = useState<'month' | 'week' | 'agenda'>(
    mobile ? 'agenda' : 'month',
  );
  const [navigation, setNavigation] = useState({ id: 0, direction: 'next' });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const navigate = (direction: number) => {
    setNavigation((current) => ({
      id: current.id + 1,
      direction: direction > 0 ? 'next' : 'previous',
    }));
    setSelected((current) => {
      const anchor = new Date(`${current}T12:00:00`);
      return format(
        view === 'month'
          ? addMonths(anchor, direction)
          : addDays(anchor, direction * 7),
        'yyyy-MM-dd',
      );
    });
  };
  const startSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStart.current =
      event.touches.length === 1
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  };
  const endSwipe = (event: TouchEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty('--swipe-offset');
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.touches.length || event.changedTouches.length !== 1)
      return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClickUntil.current = Date.now() + 400;
      navigate(dx < 0 ? 1 : -1);
    }
  };
  const date = new Date(`${selected}T12:00:00`);
  const first =
    view === 'month'
      ? startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
      : view === 'week'
        ? startOfWeek(date, { weekStartsOn: 1 })
        : date;
  const days = Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) =>
    format(addDays(first, i), 'yyyy-MM-dd'),
  );
  const [from] = dayBounds(days[0]);
  const [, to] = dayBounds(days.at(-1)!);
  let invalid = false;
  const items: {
    event: Pick<
      EventRow,
      | 'id'
      | 'title'
      | 'type'
      | 'all_day'
      | 'timezone'
      | 'dose'
      | 'location'
      | 'amount'
    >;
    occurrence: Date;
  }[] = [];
  for (const event of (query.data || []).filter(
    (event) =>
      matchesSearch(
        `${event.title} ${event.location || ''} ${event.dose || ''}`,
        search,
      ) &&
      (typeFilter === 'all' || event.type === typeFilter) &&
      matchesCategory(event.category_id, categoryFilter) &&
      (recurrence === 'all' ||
        (recurrence === 'recurring' ? !!event.rrule : !event.rrule)),
  )) {
    try {
      items.push(
        ...occurrencesBetween(event, from, to).map((occurrence) => ({
          event,
          occurrence,
        })),
      );
    } catch {
      invalid = true;
    }
  }
  if (
    (typeFilter === 'all' || typeFilter === 'task') &&
    (categoryFilter === 'all' || categoryFilter === 'none')
  ) {
    for (const task of taskOccurrences(
      tasks.data?.tasks || [],
      tasks.data?.completions || [],
      days[0],
      days.at(-1)!,
    )) {
      if (
        !task.due_on ||
        task.completed_at ||
        !matchesSearch(`${task.title} ${task.notes}`, search) ||
        (recurrence === 'recurring' && !task.rrule) ||
        (recurrence === 'once' && !!task.rrule)
      )
        continue;
      try {
        const occurrence = localInstant(
          task.due_on,
          task.due_time?.slice(0, 5) || '00:00',
        );
        if (occurrence >= from && occurrence <= to)
          items.push({
            event: {
              id: task.id,
              title: task.title,
              type: 'task',
              all_day: !task.due_time,
              timezone: 'Europe/Lisbon',
              dose: null,
              location: null,
              amount: null,
            },
            occurrence,
          });
      } catch {
        invalid = true;
      }
    }
  }
  items.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
  const visibleDays = view === 'month' ? [selected] : days;
  const fullDate = (day: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeZone: 'Europe/Lisbon',
    }).format(dayBounds(day)[0]);
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('calendar')}</h1>
          <p>{t('calendarHelp')}</p>
        </div>
        <Link className="button" to="/add/appointment">
          <Icon name="plus" />
          {t('appointmentNew')}
        </Link>
      </header>
      <SectionNavigation section={'calendar'} />
      <FilterPanel
        onSearchClear={() => setSearch('')}
        quickFilters={
          <QuickFilters
            label={explore.type}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ['all', explore.allTypes],
              ['medication', t('medications')],
              ['appointment', t('appointments')],
              ['bill', t('bills')],
              ['task', t('tasks')],
            ]}
          />
        }
        count={
          Number(!!search) +
          Number(typeFilter !== 'all') +
          Number(categoryFilter !== 'all') +
          Number(recurrence !== 'all')
        }
        onReset={() => {
          setSearch('');
          setTypeFilter('all');
          setCategoryFilter('all');
          setRecurrence('all');
        }}
        results={query.isPending ? undefined : items.length}
      >
        <TextField
          fullWidth
          type="search"
          label={explore.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label={explore.category}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            ['all', explore.allCategories],
            ['none', explore.uncategorized],
            ...(categories.data || [])
              .filter((category) =>
                ['appointment', 'bill'].includes(category.kind),
              )
              .map(
                (category) =>
                  [
                    category.id,
                    `${category.name} · ${t(category.kind === 'bill' ? 'bills' : 'appointments')}`,
                  ] as const,
              ),
          ]}
        />
        <FilterSelect
          label={explore.recurrence}
          value={recurrence}
          onChange={setRecurrence}
          options={[
            ['all', explore.allRecurrences],
            ['recurring', explore.recurring],
            ['once', explore.oneOff],
          ]}
        />
      </FilterPanel>
      {!query.isPending && !query.isError && (
        <Statistics
          label={explore.calendarSummary}
          items={[
            {
              label: explore.appointments,
              value: items.filter((item) => item.event.type === 'appointment')
                .length,
              hint: explore.calendarSummary,
              icon: 'calendar',
            },
            {
              label: explore.plannedDoses,
              value: items.filter((item) => item.event.type === 'medication')
                .length,
              hint: explore.calendarSummary,
              icon: 'pill',
            },
            {
              label: explore.billTotal,
              value: formatMoney(
                items
                  .filter((item) => item.event.type === 'bill')
                  .reduce(
                    (sum, item) => sum + toCents(item.event.amount || 0),
                    0,
                  ),
                locale,
              ),
              hint: explore.calendarSummary,
              icon: 'receipt',
            },
          ]}
        />
      )}
      {(query.isPending || tasks.isPending) && <Spinner />}
      {tasks.isError && (
        <Banner alert>
          {t('error')}
          <Button variant="secondary" onClick={() => void tasks.refetch()}>
            {t('retry')}
          </Button>
        </Banner>
      )}
      {query.isError && (
        <Banner alert>
          {t('error')}{' '}
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </Banner>
      )}
      {invalid && <Banner alert>{t('invalidSchedule')}</Banner>}
      <div className="calendar-navigation">
        <div
          className="segmented calendar-views"
          role="group"
          aria-label={t('calendar')}
        >
          {(['month', 'week', 'agenda'] as const).map((value) => (
            <Button
              key={value}
              variant="secondary"
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {t(value)}
            </Button>
          ))}
        </div>
        <div className="calendar-toolbar">
          <Button
            variant="secondary"
            aria-label={t('previous')}
            onClick={() => navigate(-1)}
          >
            ←
          </Button>
          <h2
            key={navigation.id}
            className="calendar-period"
            aria-live="polite"
            aria-atomic="true"
          >
            <CalendarDatePicker
              selected={selected}
              label={
                view === 'month'
                  ? new Intl.DateTimeFormat(locale, {
                      month: 'long',
                      year: 'numeric',
                    }).format(date)
                  : `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(first)} – ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(addDays(first, 6))}`
              }
              onChange={(day) => {
                setNavigation((current) => ({
                  id: current.id + 1,
                  direction: day >= selected ? 'next' : 'previous',
                }));
                setSelected(day);
              }}
            />
          </h2>
          <Button
            variant="secondary"
            aria-label={t('next')}
            onClick={() => navigate(1)}
          >
            →
          </Button>
          <Button
            className="calendar-today"
            variant="secondary"
            onClick={() => setSelected(localDate())}
          >
            {t('today')}
          </Button>
        </div>
      </div>
      <div
        className="calendar-swipe"
        data-testid="calendar-swipe"
        data-direction={navigation.direction}
        onTouchStart={startSwipe}
        onTouchMove={(event) => {
          const start = touchStart.current;
          if (event.touches.length !== 1 || !start) {
            touchStart.current = null;
            event.currentTarget.style.removeProperty('--swipe-offset');
            return;
          }
          const dx = event.touches[0].clientX - start.x;
          const dy = event.touches[0].clientY - start.y;
          event.currentTarget.style.setProperty(
            '--swipe-offset',
            `${Math.abs(dx) > Math.abs(dy) * 1.5 ? Math.max(-60, Math.min(60, dx * 0.4)) : 0}px`,
          );
        }}
        onTouchEnd={endSwipe}
        onTouchCancel={(event) => {
          touchStart.current = null;
          event.currentTarget.style.removeProperty('--swipe-offset');
        }}
        onClickCapture={(event) => {
          if (Date.now() < suppressClickUntil.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {mobile && <p className="calendar-swipe-hint">{explore.swipeHint}</p>}
        <div
          key={navigation.id}
          className={`calendar-content ${navigation.id ? 'calendar-content-enter' : ''}`}
        >
          {(view === 'month' || view === 'week') && (
            <div className="calendar-scroll">
              <div className="calendar-grid">
                {days.slice(0, 7).map((day) => (
                  <div className="calendar-weekday" key={`label:${day}`}>
                    {new Intl.DateTimeFormat(locale, {
                      weekday: 'short',
                    }).format(new Date(`${day}T12:00:00`))}
                  </div>
                ))}
                {days.map((day) => {
                  const count = items.filter(
                    (item) => localDate(item.occurrence) === day,
                  ).length;
                  return (
                    <Button
                      key={day}
                      className={`calendar-cell ${day.slice(0, 7) !== selected.slice(0, 7) ? 'outside' : ''}`}
                      aria-label={`${fullDate(day)}, ${count} ${t('eventType')}`}
                      aria-pressed={day === selected}
                      aria-current={day === localDate() ? 'date' : undefined}
                      onClick={() => setSelected(day)}
                    >
                      <span>{Number(day.slice(-2))}</span>
                      {count > 0 && (
                        <>
                          <span className="calendar-dot" />
                          <span>{count}</span>
                        </>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="calendar-events">
          {visibleDays.map((day) => {
            const events = items.filter(
              (item) => localDate(item.occurrence) === day,
            );
            return (
              <section key={day}>
                <h2 className="section-heading">{fullDate(day)}</h2>
                {!query.isPending &&
                !query.isError &&
                !tasks.isPending &&
                !tasks.isError &&
                events.length === 0 ? (
                  <EmptyState title={t('emptyDay')} help="" />
                ) : (
                  <Card>
                    {events.map(({ event, occurrence }) => (
                      <div
                        className="event-row"
                        key={`${event.id}:${occurrence.toISOString()}`}
                      >
                        <Icon
                          name={
                            event.type === 'task'
                              ? 'check'
                              : event.type === 'medication'
                                ? 'pill'
                                : event.type === 'bill'
                                  ? 'receipt'
                                  : 'calendar'
                          }
                        />
                        <div>
                          <h3>
                            <Link
                              to={
                                event.type === 'task'
                                  ? '/tasks'
                                  : `/items/${event.id}?at=${encodeURIComponent(occurrence.toISOString())}`
                              }
                            >
                              {event.title}
                            </Link>
                          </h3>
                          <p>
                            {event.all_day
                              ? t(
                                  event.type === 'task'
                                    ? 'taskAllDay'
                                    : 'dueDate',
                                )
                              : localTime(occurrence, event.timezone)}
                            {event.dose ? ` · ${event.dose}` : ''}
                            {event.location ? ` · ${event.location}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
