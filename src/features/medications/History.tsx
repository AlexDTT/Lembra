import {
  FilterPanel,
  FilterSelect,
  Statistics,
  QuickFilters,
} from '../../components/Explore';
import { TextField } from '@mui/material';
import { useExplore } from '../../i18n/explore';
import { matchesSearch, shiftDay } from '../../lib/filters';
import { groupMedications } from './model';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useCopy } from '../../i18n/ux';
import { useI18n } from '../../i18n/context';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Spinner,
  Modal,
  Field,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useMedications } from './queries';
import { InsightChart } from '../../components/InsightChart';
import { recordedDoseSeries } from '../../lib/insights';
import { localDate, localTime, dayBounds } from '../../lib/dates';
import { Icon } from '../../components/Icon';
import { useOnline } from '../../lib/network';
import { occurrencesBetween } from '../../lib/recurrence';
import type { CompletionRow } from '../../types/domain';
import { fetchAll } from '../../lib/pagination';

export function History() {
  const copy = useCopy();
  const online = useOnline();
  const client = useQueryClient();
  const [correcting, setCorrecting] = useState<CompletionRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [pastDay, setPastDay] = useState(shiftDay(localDate(), -1));
  const [recording, setRecording] = useState(false);
  const explore = useExplore();
  const [search, setSearch] = useState('');
  const [medication, setMedication] = useState('all');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('30');
  const [sort, setSort] = useState('newest');
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const medications = useMedications();
  const [day] = useState(() => localDate());
  const query = useQuery({
    queryKey: ['history', session!.user.id],
    queryFn: ({ signal }) =>
      fetchAll((from, to) =>
        supabase
          .from('event_completions')
          .select('*')
          .eq('user_id', session!.user.id)
          .gte(
            'occurrence_at',
            dayBounds(shiftDay(localDate(), -29))[0].toISOString(),
          )
          .lte('occurrence_at', new Date().toISOString())
          .order('occurrence_at', { ascending: false })
          .order('id')
          .range(from, to)
          .abortSignal(signal),
      ),
  });
  const groups = groupMedications(medications.data || []);
  const firstDay = shiftDay(day, 1 - Number(period));
  const items = query.data
    ?.filter((item) => {
      const row = medications.data?.find((row) => row.id === item.event_id);
      return (
        !!row &&
        (medication === 'all' || (row.group_id || row.id) === medication) &&
        (status === 'all' || item.status === status) &&
        localDate(new Date(item.occurrence_at)) >= firstDay &&
        matchesSearch(`${row.title} ${row.dose || ''}`, search)
      );
    })
    .sort(
      (a, b) =>
        (new Date(a.occurrence_at).getTime() -
          new Date(b.occurrence_at).getTime()) *
        (sort === 'newest' ? -1 : 1),
    );
  const series = recordedDoseSeries(items || [], day, Number(period));
  const groupSeries = groups
    .map((group) => ({
      title: group.rows[0].title,
      taken: (items || []).filter(
        (item) =>
          item.status === 'done' &&
          group.rows.some((row) => row.id === item.event_id),
      ).length,
      skipped: (items || []).filter(
        (item) =>
          item.status === 'skipped' &&
          group.rows.some((row) => row.id === item.event_id),
      ).length,
    }))
    .filter((group) => group.taken + group.skipped > 0);
  const filterCount =
    Number(!!search) +
    Number(medication !== 'all') +
    Number(status !== 'all') +
    Number(period !== '30') +
    Number(sort !== 'newest');
  const ready =
    !query.isPending &&
    !medications.isPending &&
    !query.isError &&
    !medications.isError;
  const refresh = async () => {
    await Promise.all(
      ['history', 'completions'].map((key) =>
        client.invalidateQueries({ queryKey: [key, session!.user.id] }),
      ),
    );
    for (const key of Object.keys(localStorage))
      if (key.startsWith(`lembra-data:completions:${session!.user.id}:`))
        localStorage.removeItem(key);
  };
  const correct = (status: 'done' | 'skipped' | null) => {
    if (!correcting) return;
    setPending(true);
    setError(false);
    void (async () => {
      const request =
        status === null
          ? supabase
              .from('event_completions')
              .delete()
              .eq('id', correcting.id)
              .eq('user_id', session!.user.id)
          : supabase
              .from('event_completions')
              .update({ status, completed_at: new Date().toISOString() })
              .eq('id', correcting.id)
              .eq('user_id', session!.user.id);
      const { error } = await request;
      if (error) throw error;
      await refresh();
      setCorrecting(null);
    })()
      .catch(() => setError(true))
      .finally(() => setPending(false));
  };
  const pastValid =
    /^\d{4}-\d{2}-\d{2}$/.test(pastDay) &&
    pastDay >= shiftDay(localDate(), -29) &&
    pastDay <= localDate();
  const [pastFrom, pastTo] = dayBounds(pastValid ? pastDay : localDate());
  let pastInvalid = false;
  const pastItems = pastValid
    ? (medications.data || [])
        .filter((e) => e.active)
        .flatMap((event) => {
          try {
            return occurrencesBetween(event, pastFrom, pastTo)
              .filter(
                (occurrence) =>
                  occurrence <= new Date() &&
                  !query.data?.some(
                    (c) =>
                      c.event_id === event.id &&
                      new Date(c.occurrence_at).getTime() ===
                        occurrence.getTime(),
                  ),
              )
              .map((occurrence) => ({ event, occurrence }));
          } catch {
            pastInvalid = true;
            return [];
          }
        })
    : [];
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('history')}</h1>
          <p>{copy.historyHelp}</p>
        </div>
        <Link className="button secondary" to="/medications">
          {t('medications')}
        </Link>
      </header>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={!ready || !online}
          onClick={() => setRecording(true)}
        >
          {t('recordPast')}
        </Button>
      </div>
      <FilterPanel
        onSearchClear={() => setSearch('')}
        quickFilters={
          <>
            <QuickFilters
              label={explore.period}
              value={period}
              onChange={setPeriod}
              options={[
                ['7', explore.last7],
                ['14', explore.last14],
                ['30', explore.last30],
              ]}
            />
            <QuickFilters
              label={explore.status}
              value={status}
              onChange={setStatus}
              options={[
                ['all', explore.allRecords],
                ['done', explore.taken],
                ['skipped', explore.skipped],
              ]}
            />
          </>
        }
        count={filterCount}
        onReset={() => {
          setSearch('');
          setMedication('all');
          setStatus('all');
          setPeriod('30');
          setSort('newest');
        }}
        results={
          query.isPending || medications.isPending ? undefined : items?.length
        }
      >
        <TextField
          fullWidth
          type="search"
          label={copy.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label={explore.medication}
          value={medication}
          onChange={setMedication}
          options={[
            ['all', explore.allMedications],
            ...groups.map((group) => [group.id, group.rows[0].title] as const),
          ]}
        />
        <FilterSelect
          label={explore.sort}
          value={sort}
          onChange={setSort}
          options={[
            ['newest', explore.newest],
            ['soonest', explore.soonest],
          ]}
        />
      </FilterPanel>
      {(query.isPending || medications.isPending) && <Spinner />}
      {(query.isError || medications.isError) && (
        <Banner alert>
          {t('error')}
          <Button
            variant="secondary"
            onClick={() => {
              void query.refetch();
              void medications.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </Banner>
      )}
      {ready && !!items?.length && (
        <>
          <Statistics
            items={[
              {
                label: explore.recordedTaken,
                value: items.filter((item) => item.status === 'done').length,
                icon: 'check',
                hint: explore.selection,
              },
              {
                label: explore.recordedSkipped,
                value: items.filter((item) => item.status === 'skipped').length,
                icon: 'clock',
                hint: explore.selection,
              },
              {
                label: explore.daysRecorded,
                value: new Set(
                  items.map((item) => localDate(new Date(item.occurrence_at))),
                ).size,
                icon: 'calendar',
                hint: explore.selection,
              },
            ]}
          />
          <p className="list-window">{explore.recordedOnly}</p>
          <Card className="insight-panel">
            <header>
              <h2>{explore.dailyRecords}</h2>
              <p>{t('doseInsightsHelp')}</p>
            </header>
            <InsightChart
              title={t('recordedDoses')}
              labels={series.map((item) =>
                new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${item.key}T12:00:00Z`)),
              )}
              series={[
                {
                  name: t('done'),
                  values: series.map((item) => item.taken),
                  color: '#53744a',
                },
                {
                  name: t('skipped'),
                  values: series.map((item) => item.skipped),
                  color: '#b28631',
                },
              ]}
            />
          </Card>
          <details className="spending-details">
            <summary>
              <Icon name="pill" />
              {explore.medicationRecords}
            </summary>
            <InsightChart
              title={explore.medicationRecords}
              labels={groupSeries.map((group) => group.title)}
              series={[
                {
                  name: explore.taken,
                  values: groupSeries.map((group) => group.taken),
                  color: '#176b5b',
                },
                {
                  name: explore.skipped,
                  values: groupSeries.map((group) => group.skipped),
                  color: '#b28631',
                },
              ]}
            />
          </details>
        </>
      )}
      {ready && items?.length === 0 && (
        <EmptyState title={t('noHistory')} help={t('historyEmptyHelp')} />
      )}
      {items?.map((item) => (
        <Card key={item.id}>
          <h2>
            {medications.data?.find((m) => m.id === item.event_id)?.title}
          </h2>
          <p>
            {t('scheduledTime')}:
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Europe/Lisbon',
            }).format(new Date(item.occurrence_at))}
          </p>
          <p>
            {t('recordedTime')}:{' '}
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Europe/Lisbon',
            }).format(new Date(item.completed_at))}
          </p>
          <Button
            variant="secondary"
            disabled={!online || pending}
            onClick={() => {
              setError(false);
              setCorrecting(item);
            }}
          >
            {t('correctRecord')}
          </Button>
          <span className="pill">
            {t(item.status === 'done' ? 'done' : 'skipped')}
          </span>
        </Card>
      ))}
      {correcting && (
        <Modal
          title={t('correctRecord')}
          onClose={() => setCorrecting(null)}
          busy={pending}
        >
          <p>
            {medications.data?.find((e) => e.id === correcting.event_id)?.title}
          </p>
          <p>{t('correctHelp')}</p>
          <div className="actions">
            <Button
              disabled={pending || !online}
              onClick={() => correct('done')}
            >
              {t('taken')}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || !online}
              onClick={() => correct('skipped')}
            >
              {t('skip')}
            </Button>
            <Button
              variant="danger"
              disabled={pending || !online}
              onClick={() => correct(null)}
            >
              {t('removeRecord')}
            </Button>
          </div>
          {error && <Banner alert>{t('actionError')}</Banner>}
        </Modal>
      )}
      {recording && (
        <Modal
          title={t('recordPast')}
          onClose={() => setRecording(false)}
          busy={pending}
        >
          <p>{t('unrecordedHelp')}</p>
          <div className="actions">
            <Button
              variant="secondary"
              onClick={() => setPastDay(shiftDay(localDate(), -1))}
            >
              {t('yesterday')}
            </Button>
            <Button variant="secondary" onClick={() => setPastDay(localDate())}>
              {t('todayRecords')}
            </Button>
          </div>
          <Field label={t('date')}>
            <input
              type="date"
              required
              min={shiftDay(localDate(), -29)}
              max={localDate()}
              value={pastDay}
              onChange={(e) => setPastDay(e.target.value)}
            />
          </Field>
          {!pastValid && <Banner alert>{t('checkField')}</Banner>}
          {pastInvalid && <Banner alert>{t('invalidSchedule')}</Banner>}
          {error && <Banner alert>{t('actionError')}</Banner>}
          {pastItems.map(({ event, occurrence }) => (
            <Card key={`${event.id}:${occurrence.toISOString()}`}>
              <h3>
                {event.title} · {localTime(occurrence, event.timezone)}
              </h3>
              <div className="actions">
                {(['done', 'skipped'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={status === 'done' ? 'primary' : 'secondary'}
                    disabled={pending || !online}
                    onClick={() => {
                      setPending(true);
                      setError(false);
                      void (async () => {
                        const { error } = await supabase
                          .from('event_completions')
                          .upsert(
                            {
                              user_id: session!.user.id,
                              event_id: event.id,
                              occurrence_at: occurrence.toISOString(),
                              status,
                              completed_at: new Date().toISOString(),
                            },
                            { onConflict: 'event_id,occurrence_at' },
                          );
                        if (error) throw error;
                        await refresh();
                      })()
                        .catch(() => setError(true))
                        .finally(() => setPending(false));
                    }}
                  >
                    {t(status === 'done' ? 'taken' : 'skip')}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
          {pastValid && !pastItems.length && <p>{t('allDone')}</p>}
        </Modal>
      )}
    </>
  );
}
