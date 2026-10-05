import { SectionNavigation } from '../../components/SectionNavigation';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, TextField } from '@mui/material';
import {
  FilterPanel,
  FilterSelect,
  Statistics,
  QuickFilters,
} from '../../components/Explore';
import { InsightChart } from '../../components/InsightChart';
import { useExplore } from '../../i18n/explore';
import {
  matchesSearch,
  matchesCategory,
  shiftDay,
  matchesDatePeriod,
} from '../../lib/filters';
import { useCopy } from '../../i18n/ux';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Spinner,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { dayBounds, localDate, localTime } from '../../lib/dates';
import { occurrencesBetween } from '../../lib/recurrence';
import {
  decimalAmount,
  formatMoney,
  parseCents,
  toCents,
} from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { useCareBackend } from '../../lib/backend';
import { useOnline } from '../../lib/network';
import type { EventRow } from '../../types/domain';
import {
  useEvents,
  useEventActions,
  useBillCompletions,
  useCategories,
} from './queries';
import { EventForm } from './EventForm';

export function Events({ type }: { type: 'appointment' | 'bill' }) {
  const { t, locale } = useI18n();
  const copy = useCopy();
  const explore = useExplore();
  const categories = useCategories();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [period, setPeriod] = useState(type === 'bill' ? 'all' : 'upcoming');
  const [recurrence, setRecurrence] = useState('all');
  const [sort, setSort] = useState('soonest');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const { session } = useAuth();
  const query = useEvents();
  const { remove } = useEventActions();
  const client = useQueryClient();
  const online = useOnline();
  const backend = useCareBackend();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<
    Date | undefined
  >();
  const [deleteOccurrence, setDeleteOccurrence] = useState<Date | undefined>();
  const [deleteScope, setDeleteScope] = useState<'series' | 'single'>('series');
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [paying, setPaying] = useState<{
    event: EventRow;
    occurrence: Date;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(localDate());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [now] = useState(() => Date.now());
  const completions = useBillCompletions(type === 'bill');
  const today = localDate(new Date(now));
  const [from] = dayBounds(shiftDay(today, -90));
  const [, to] = dayBounds(shiftDay(today, 90));
  let invalid = false;
  const items: { event: EventRow; occurrence: Date }[] = [];
  for (const event of (query.data || []).filter(
    (event) => event.type === type,
  )) {
    try {
      items.push(
        ...occurrencesBetween(
          event,
          type === 'bill' && !event.rrule ? new Date(event.starts_at) : from,
          to,
        ).map((occurrence) => ({
          event,
          occurrence,
        })),
      );
    } catch {
      invalid = true;
    }
  }
  items.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
  const completed = (event: EventRow, occurrence: Date) =>
    completions.data?.find(
      (c) =>
        c.event_id === event.id &&
        new Date(c.occurrence_at).getTime() === occurrence.getTime(),
    );
  const visibleItems = items.filter(
    ({ event, occurrence }) =>
      matchesSearch(`${event.title} ${event.location || ''}`, search) &&
      matchesCategory(event.category_id, categoryFilter) &&
      (recurrence === 'all' ||
        (recurrence === 'recurring' ? !!event.rrule : !event.rrule)) &&
      matchesDatePeriod(
        localDate(occurrence),
        period,
        today,
        !!completed(event, occurrence),
      ) &&
      (type !== 'bill' ||
        filter === 'all' ||
        (filter === 'paid'
          ? !!completed(event, occurrence)
          : !completed(event, occurrence))),
  );
  visibleItems.sort((a, b) => {
    if (sort === 'name')
      return a.event.title.localeCompare(b.event.title, locale);
    if (sort === 'amountHigh' || sort === 'amountLow')
      return (
        (toCents(a.event.amount || 0) - toCents(b.event.amount || 0)) *
        (sort === 'amountHigh' ? -1 : 1)
      );
    return (
      (a.occurrence.getTime() - b.occurrence.getTime()) *
      (sort === 'newest' ? -1 : 1)
    );
  });
  const selectedAmount = visibleItems.reduce(
    (sum, item) =>
      sum +
      toCents(
        completed(item.event, item.occurrence)?.amount_paid ??
          item.event.amount ??
          0,
      ),
    0,
  );
  const overdueAmount = visibleItems
    .filter(
      (item) =>
        !completed(item.event, item.occurrence) &&
        localDate(item.occurrence) < today,
    )
    .reduce((sum, item) => sum + toCents(item.event.amount || 0), 0);
  const withinWeek = visibleItems.filter(
    (item) =>
      localDate(item.occurrence) >= today &&
      localDate(item.occurrence) <= shiftDay(today, 6),
  );
  const categoryValues = [
    ...new Set(visibleItems.map((item) => item.event.category_id)),
  ].map((id) => ({
    label:
      categories.data?.find((category) => category.id === id)?.name ||
      explore.uncategorized,
    value: visibleItems
      .filter((item) => item.event.category_id === id)
      .reduce(
        (sum, item) =>
          sum +
          (type === 'bill'
            ? toCents(
                completed(item.event, item.occurrence)?.amount_paid ??
                  item.event.amount ??
                  0,
              )
            : 1),
        0,
      ),
  }));
  const filterCount =
    Number(!!search) +
    Number(categoryFilter !== 'all') +
    Number(period !== (type === 'bill' ? 'all' : 'upcoming')) +
    Number(recurrence !== 'all') +
    Number(sort !== 'soonest') +
    Number(filter !== 'unpaid');
  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setPeriod(type === 'bill' ? 'all' : 'upcoming');
    setRecurrence('all');
    setSort('soonest');
    setFilter('unpaid');
  };
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: ['bill-completions', session!.user.id],
    });
    await client.invalidateQueries({
      queryKey: ['expenses', session!.user.id],
    });
    await client.invalidateQueries({
      queryKey: ['completions', session!.user.id],
    });
  };
  const run = (fn: () => Promise<unknown>, finish: () => void) => {
    setError(false);
    setPending(true);
    void fn()
      .then(finish)
      .catch(() => setError(true))
      .finally(() => setPending(false));
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t('organize')}</p>
          <h1>{t(type === 'bill' ? 'bills' : 'appointments')}</h1>
          <p>{type === 'bill' ? copy.billIntro : copy.appointmentIntro}</p>
        </div>
        <Link className="button" to={`/add/${type}`}>
          <Icon name="plus" />
          {t(type === 'bill' ? 'billNew' : 'appointmentNew')}
        </Link>
      </header>
      <SectionNavigation
        section={type === 'appointment' ? 'calendar' : 'money'}
      />
      <FilterPanel
        onSearchClear={() => setSearch('')}
        quickFilters={
          <>
            {type === 'bill' && (
              <QuickFilters
                label={t('bills')}
                value={filter}
                onChange={(value) => {
                  setFilter(value as typeof filter);
                  if (value === 'paid' && period === 'overdue')
                    setPeriod('all');
                }}
                options={[
                  ['unpaid', copy.unpaid],
                  ['paid', copy.paid],
                  ['all', copy.all],
                ]}
              />
            )}
            <QuickFilters
              label={explore.period}
              value={period}
              onChange={(value) => {
                setPeriod(value);
                if (value === 'overdue') setFilter('unpaid');
              }}
              options={
                type === 'bill'
                  ? [
                      ['all', explore.allDates],
                      ['overdue', explore.overdue],
                      ['next7', explore.next7],
                    ]
                  : [
                      ['upcoming', copy.upcoming],
                      ['next7', explore.next7],
                      ['next30', explore.next30],
                      ['past90', explore.past90],
                    ]
              }
            />
          </>
        }
        count={filterCount}
        onReset={resetFilters}
        results={query.isPending ? undefined : visibleItems.length}
      >
        <TextField
          fullWidth
          type="search"
          label={copy.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterSelect
          label={explore.category}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            ['all', explore.allCategories],
            ['none', explore.uncategorized],
            ...(categories.data || [])
              .filter((category) => category.kind === type)
              .map((category) => [category.id, category.name] as const),
          ]}
        />
        <FilterSelect
          label={explore.period}
          resetValue={type === 'bill' ? 'all' : 'upcoming'}
          value={period}
          onChange={(value) => {
            setPeriod(value);
            if (value === 'overdue') setFilter('unpaid');
          }}
          options={[
            ['all', explore.allDates],
            ['upcoming', copy.upcoming],
            ['next7', explore.next7],
            ['next30', explore.next30],
            ['past90', explore.past90],
            ...(type === 'bill' ? [['overdue', explore.overdue] as const] : []),
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
        <FilterSelect
          label={explore.sort}
          value={sort}
          onChange={setSort}
          options={[
            ['soonest', explore.soonest],
            ['newest', explore.newest],
            ['name', explore.name],
            ...(type === 'bill'
              ? ([
                  ['amountHigh', explore.amountHigh],
                  ['amountLow', explore.amountLow],
                ] as const)
              : []),
          ]}
        />
      </FilterPanel>
      {!query.isPending &&
        !query.isError &&
        (type !== 'bill' ||
          (!completions.isPending && !completions.isError)) && (
          <Statistics
            items={
              type === 'bill'
                ? [
                    {
                      label:
                        filter === 'paid'
                          ? explore.paidTotal
                          : filter === 'unpaid'
                            ? explore.unpaidTotal
                            : explore.billTotal,
                      value: formatMoney(selectedAmount, locale),
                      icon: 'wallet',
                      hint: explore.selection,
                    },
                    {
                      label: explore.overdueTotal,
                      value: formatMoney(overdueAmount, locale),
                      icon: 'receipt',
                      hint: explore.selection,
                    },
                    {
                      label: explore.occurrences,
                      value: visibleItems.length,
                      icon: 'calendar',
                      hint: explore.selection,
                    },
                  ]
                : [
                    {
                      label: explore.appointments,
                      value: visibleItems.length,
                      icon: 'calendar',
                      hint: explore.selection,
                    },
                    {
                      label: explore.thisWeek,
                      value: withinWeek.length,
                      icon: 'clock',
                      hint: explore.selection,
                    },
                    {
                      label: explore.locations,
                      value: new Set(
                        visibleItems
                          .map((item) => item.event.location?.trim())
                          .filter(Boolean),
                      ).size,
                      icon: 'location',
                      hint: explore.selection,
                    },
                  ]
            }
          />
        )}
      <p className="list-window">{explore.rangeHelp}</p>
      {!query.isPending && !query.isError && categoryValues.length > 0 && (
        <details className="spending-details category-analysis">
          <summary>
            <Icon name="wallet" />
            {explore.byCategory}
          </summary>
          <InsightChart
            title={explore.byCategory}
            money={type === 'bill'}
            labels={categoryValues.map((item) => item.label)}
            series={[
              {
                name:
                  type === 'bill' ? explore.billTotal : explore.appointments,
                values: categoryValues.map((item) => item.value),
                color: '#176b5b',
              },
            ]}
          />
        </details>
      )}
      {query.isPending && <Spinner />}
      {(query.isError || completions.isError) && (
        <Banner alert>
          {t('error')}{' '}
          <Button
            variant="secondary"
            onClick={() => {
              void query.refetch();
              void completions.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </Banner>
      )}
      {invalid && <Banner alert>{t('invalidSchedule')}</Banner>}
      {error && <Banner alert>{t('actionError')}</Banner>}
      {!query.isPending && !query.isError && items.length === 0 && (
        <EmptyState
          title={t(type === 'bill' ? 'emptyBills' : 'emptyAppointments')}
          help={t(type === 'bill' ? 'emptyBillsHelp' : 'emptyAppointmentsHelp')}
        />
      )}
      {!query.isPending &&
        !query.isError &&
        items.length > 0 &&
        visibleItems.length === 0 && (
          <EmptyState title={copy.noMatches} help={copy.noMatchesHelp} />
        )}
      {visibleItems.map(({ event, occurrence }) => {
        const completion = completions.data?.find(
          (c) =>
            c.event_id === event.id &&
            new Date(c.occurrence_at).getTime() === occurrence.getTime(),
        );
        return (
          <Card
            key={`${event.id}:${occurrence.toISOString()}`}
            className={`event-card ${completion ? 'completed' : ''}`}
          >
            <div className="event-row">
              <span className="event-date">
                <strong>
                  {new Intl.DateTimeFormat(locale, {
                    day: '2-digit',
                    timeZone: event.timezone,
                  }).format(occurrence)}
                </strong>
                <span>
                  {new Intl.DateTimeFormat(locale, {
                    month: 'short',
                    timeZone: event.timezone,
                  }).format(occurrence)}
                </span>
              </span>
              <div>
                <h2>
                  <Link
                    to={`/items/${event.id}?at=${encodeURIComponent(occurrence.toISOString())}`}
                  >
                    {event.title}
                  </Link>
                </h2>
                <p>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeZone: event.timezone,
                  }).format(occurrence)}
                  {type === 'appointment'
                    ? ` · ${localTime(occurrence, event.timezone)}`
                    : ''}
                </p>
                {event.location && <p>{event.location}</p>}
                {type === 'bill' && (
                  <p className="bill-amount">
                    <strong>
                      {formatMoney(toCents(event.amount || 0), locale)}
                    </strong>{' '}
                    <Chip
                      size="small"
                      color={
                        completion
                          ? 'success'
                          : localDate(occurrence) < localDate()
                            ? 'warning'
                            : 'default'
                      }
                      label={
                        completion
                          ? t('paid')
                          : localDate(occurrence) < localDate()
                            ? t('overdue')
                            : t('pending')
                      }
                    />
                  </p>
                )}
              </div>
            </div>
            <div className="actions">
              {type === 'bill' &&
                (completion ? (
                  <Button
                    variant="secondary"
                    disabled={pending || !online}
                    onClick={() =>
                      run(
                        async () => {
                          const { error } = await supabase
                            .from('event_completions')
                            .delete()
                            .eq('id', completion.id)
                            .eq('user_id', session!.user.id);
                          if (error) throw error;
                          await refresh();
                        },
                        () => {},
                      )
                    }
                  >
                    {t('undo')}
                  </Button>
                ) : (
                  <Button
                    disabled={
                      pending ||
                      !online ||
                      completions.isPending ||
                      completions.isError
                    }
                    onClick={() => {
                      setAmount((event.amount || 0).toFixed(2));
                      setPaidOn(localDate());
                      setPaying({ event, occurrence });
                    }}
                  >
                    {t('markPaid')}
                  </Button>
                ))}
              <Button
                variant="secondary"
                disabled={!online || pending}
                onClick={() => {
                  setEditing(event);
                  setEditingOccurrence(occurrence);
                }}
              >
                <Icon name="edit" />
                {t('edit')}
              </Button>
              <Button
                variant="secondary"
                disabled={!online || pending}
                onClick={() => {
                  setDeleting(event);
                  setDeleteOccurrence(occurrence);
                  setDeleteScope('series');
                }}
              >
                <Icon name="trash" />
                {t('delete')}
              </Button>
            </div>
          </Card>
        );
      })}
      {editing && (
        <Modal
          title={t(type === 'bill' ? 'billEdit' : 'appointmentEdit')}
          onClose={() => setEditing(null)}
        >
          <EventForm
            type={type}
            event={editing}
            occurrence={editingOccurrence}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
      {deleting && (
        <Modal
          title={t('deleteItem')}
          busy={pending}
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <p>{t('deleteItemHelp')}</p>
          {deleting.type === 'appointment' && deleting.rrule && (
            <Field label={t('editScope')}>
              <select
                value={deleteScope}
                onChange={(e) =>
                  setDeleteScope(e.target.value as 'series' | 'single')
                }
              >
                <option value="series">{t('wholeSeries')}</option>
                <option value="single" disabled={backend.data !== true}>
                  {t('thisOccurrence')}
                </option>
              </select>
            </Field>
          )}
          <div className="actions">
            <Button
              variant="danger"
              disabled={pending || !online}
              onClick={() =>
                run(
                  async () => {
                    if (deleteScope === 'single' && deleteOccurrence) {
                      const { error } = await supabase.rpc(
                        'save_appointment_occurrence',
                        {
                          p_event_id: deleting.id,
                          p_occurrence_at: deleteOccurrence.toISOString(),
                          p_input: null,
                        },
                      );
                      if (error) throw error;
                      await client.invalidateQueries({
                        queryKey: ['events', session!.user.id],
                      });
                    } else await remove(deleting.id);
                  },
                  () => setDeleting(null),
                )
              }
            >
              {t('delete')}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              {t('cancel')}
            </Button>
          </div>
          {error && <Banner alert>{t('actionError')}</Banner>}
        </Modal>
      )}
      {paying && (
        <Modal
          title={t('markPaid')}
          busy={pending}
          onClose={() => {
            if (!pending) setPaying(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let cents: number;
              try {
                cents = parseCents(amount);
              } catch {
                setError(true);
                return;
              }
              run(
                async () => {
                  const { error } = await supabase.rpc('mark_bill_paid', {
                    p_event_id: paying.event.id,
                    p_occurrence_at: paying.occurrence.toISOString(),
                    p_amount_paid: decimalAmount(cents),
                    p_paid_on: paidOn,
                  });
                  if (error) throw error;
                  await refresh();
                },
                () => setPaying(null),
              );
            }}
          >
            <p>{t('payHelp')}</p>
            <Field label={t('amountPaid')}>
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label={t('paidOn')}>
              <input
                required
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </Field>
            {error && <Banner alert>{t('actionError')}</Banner>}
            <Button type="submit" disabled={pending || !online}>
              {t('confirm')}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
