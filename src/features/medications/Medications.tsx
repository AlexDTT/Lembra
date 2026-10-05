import { TextField, Chip } from '@mui/material';
import {
  FilterPanel,
  FilterSelect,
  Statistics,
  QuickFilters,
} from '../../components/Explore';
import { useExplore } from '../../i18n/explore';
import { matchesSearch, shiftDay } from '../../lib/filters';
import { dayBounds, localDate, localTime } from '../../lib/dates';
import { occurrencesBetween } from '../../lib/recurrence';
import { useCopy } from '../../i18n/ux';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/context';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Modal,
  Spinner,
} from '../../components/ui';
import { useOnline } from '../../lib/network';
import { groupMedications, type MedicationGroup } from './model';
import { useMedications, useMedicationActions } from './queries';
import { MedicationForm } from './MedicationForm';
import { Icon } from '../../components/Icon';
import { MedicationPhoto } from './Photo';

export function Medications() {
  const { t } = useI18n();
  const copy = useCopy();
  const explore = useExplore();
  const [schedule, setSchedule] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [today] = useState(() => localDate());
  const [stopping, setStopping] = useState<MedicationGroup | null>(null);
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const online = useOnline();
  const query = useMedications();
  const { remove, setActive } = useMedicationActions();
  const [editing, setEditing] = useState<MedicationGroup | null>(null);
  const [deleting, setDeleting] = useState<MedicationGroup | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const groups = groupMedications(query.data || [])
    .filter((group) => {
      const first = group.rows[0];
      return (
        matchesSearch(`${first.title} ${first.dose || ''}`, search) &&
        (filter === 'all' ||
          (filter === 'active' ? first.active : !first.active)) &&
        (schedule === 'all' ||
          (schedule === 'daily'
            ? first.rrule?.includes('FREQ=DAILY')
            : !first.rrule?.includes('FREQ=DAILY'))) &&
        (photoFilter === 'all' ||
          (photoFilter === 'with' ? !!first.photo_path : !first.photo_path)) &&
        (timeFilter === 'all' ||
          group.rows.some((row) => {
            const hour = Number(
              localTime(row.starts_at, row.timezone).slice(0, 2),
            );
            return timeFilter === 'morning'
              ? hour < 12
              : timeFilter === 'afternoon'
                ? hour >= 12 && hour < 18
                : hour >= 18;
          }))
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.rows[0].title.localeCompare(b.rows[0].title)
        : localTime(a.rows[0].starts_at, a.rows[0].timezone).localeCompare(
            localTime(b.rows[0].starts_at, b.rows[0].timezone),
          ),
    );
  const [from] = dayBounds(today);
  const [, to] = dayBounds(shiftDay(today, 6));
  let planned = 0,
    invalid = false;
  for (const group of groups)
    for (const row of group.rows) {
      try {
        planned += occurrencesBetween(row, from, to).length;
      } catch {
        invalid = true;
      }
    }
  const filterCount =
    Number(!!search) +
    Number(filter !== 'active') +
    Number(schedule !== 'all') +
    Number(timeFilter !== 'all') +
    Number(photoFilter !== 'all') +
    Number(sort !== 'name');
  const resetFilters = () => {
    setSearch('');
    setFilter('active');
    setSchedule('all');
    setTimeFilter('all');
    setPhotoFilter('all');
    setSort('name');
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t('personalCare')}</p>
          <h1>{t('medications')}</h1>
          <p>{copy.medicationIntro}</p>
        </div>
        <Link className="button" to="/add/medication">
          <Icon name="plus" />
          {t('newMedication')}
        </Link>
      </header>
      <FilterPanel
        onSearchClear={() => setSearch('')}
        quickFilters={
          <QuickFilters
            label={explore.status}
            value={filter}
            onChange={(value) => setFilter(value as typeof filter)}
            options={[
              ['active', explore.active],
              ['inactive', explore.inactive],
              ['all', explore.allStates],
            ]}
          />
        }
        count={filterCount}
        onReset={resetFilters}
        results={query.isPending ? undefined : groups.length}
      >
        <TextField
          fullWidth
          type="search"
          label={t('searchMedications')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label={explore.recurrence}
          value={schedule}
          onChange={setSchedule}
          options={[
            ['all', explore.allRecurrences],
            ['daily', explore.daily],
            ['days', explore.selectedDays],
          ]}
        />
        <FilterSelect
          label={explore.timeOfDay}
          value={timeFilter}
          onChange={setTimeFilter}
          options={[
            ['all', explore.allTimes],
            ['morning', explore.morning],
            ['afternoon', explore.afternoon],
            ['evening', explore.evening],
          ]}
        />
        <FilterSelect
          label={explore.photos}
          value={photoFilter}
          onChange={setPhotoFilter}
          options={[
            ['all', explore.allPhotos],
            ['with', explore.withPhoto],
            ['without', explore.withoutPhoto],
          ]}
        />
        <FilterSelect
          label={explore.sort}
          value={sort}
          onChange={setSort}
          options={[
            ['name', explore.name],
            ['time', explore.timeOfDay],
          ]}
        />
      </FilterPanel>
      {!query.isPending && !query.isError && (
        <Statistics
          items={[
            {
              label: explore.medications,
              value: groups.length,
              hint: explore.selection,
              icon: 'pill',
            },
            {
              label: explore.plannedDoses,
              value: invalid ? '…' : planned,
              hint: explore.next7,
              icon: 'calendar',
            },
            {
              label: explore.schedules,
              value: groups.reduce(
                (sum, group) =>
                  sum + group.rows.filter((row) => row.active).length,
                0,
              ),
              hint: explore.selection,
              icon: 'clock',
            },
          ]}
        />
      )}
      {invalid && <Banner alert>{t('invalidSchedule')}</Banner>}
      <Link className="insight-link" to="/medications/history">
        <Icon name="clock" />
        {t('history')}
        <Icon name="arrow" />
      </Link>
      {query.isError && (
        <Banner alert>
          {t('error')}{' '}
          <Button
            variant="secondary"
            onClick={() => {
              void query.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </Banner>
      )}
      {query.isPending && online && <Spinner />}
      {query.isPending && !online && <Banner>{t('noCachedData')}</Banner>}
      {query.data?.length === 0 && (
        <EmptyState
          title={t('emptyMedications')}
          help={t('emptyMedicationsHelp')}
        />
      )}
      {!!query.data?.length && groups.length === 0 && (
        <EmptyState title={t('noMatches')} help={t('noMatchesHelp')} />
      )}
      <div className="medication-grid">
        {query.data &&
          groups.map((group) => (
            <Card key={group.id} className="medication-card">
              <MedicationPhoto path={group.rows[0].photo_path} />
              <h2>{group.rows[0].title}</h2>
              <p>{group.rows[0].dose}</p>
              <p>
                <Icon name="clock" />{' '}
                {group.rows
                  .map((row) => localTime(row.starts_at, row.timezone))
                  .join(' · ')}
              </p>
              <Chip
                size="small"
                color={group.rows[0].active ? 'success' : 'default'}
                label={t(group.rows[0].active ? 'active' : 'inactive')}
              />
              <div className="actions">
                <Button
                  variant="secondary"
                  disabled={!online || pending}
                  onClick={() => setStopping(group)}
                >
                  {t(
                    group.rows[0].active
                      ? 'stopMedication'
                      : 'resumeMedication',
                  )}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!online}
                  onClick={() => setEditing(group)}
                >
                  <Icon name="edit" />
                  {t('edit')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!online}
                  onClick={() => {
                    setError(false);
                    setDeleting(group);
                  }}
                >
                  <Icon name="trash" />
                  {t('delete')}
                </Button>
              </div>
            </Card>
          ))}
      </div>
      {stopping && (
        <Modal
          title={t(
            stopping.rows[0].active ? 'stopMedication' : 'resumeMedication',
          )}
          onClose={() => setStopping(null)}
          busy={pending}
        >
          <p>{stopping.rows[0].title}</p>
          <p>{t(stopping.rows[0].active ? 'stopHelp' : 'resumeHelp')}</p>
          <Button
            disabled={pending || !online}
            onClick={() => {
              setPending(true);
              setError(false);
              void setActive(stopping, !stopping.rows[0].active)
                .then(() => setStopping(null))
                .catch(() => setError(true))
                .finally(() => setPending(false));
            }}
          >
            {t('confirm')}
          </Button>
          {error && <Banner alert>{t('actionError')}</Banner>}
        </Modal>
      )}
      {editing && (
        <Modal title={t('editMedication')} onClose={() => setEditing(null)}>
          <MedicationForm group={editing} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {deleting && (
        <Modal
          title={t('deleteTitle')}
          busy={pending}
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <p>{t('deleteHelp')}</p>
          {error && <Banner alert>{t('actionError')}</Banner>}
          <div className="actions">
            <Button
              variant="danger"
              disabled={pending || !online}
              onClick={() => {
                setPending(true);
                void remove(deleting)
                  .then(() => setDeleting(null))
                  .catch(() => setError(true))
                  .finally(() => setPending(false));
              }}
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
        </Modal>
      )}
    </>
  );
}
