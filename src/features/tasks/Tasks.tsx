import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, TextField } from '@mui/material';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Modal,
  Spinner,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/context';
import { useOnline } from '../../lib/network';
import { localDate, dayBounds } from '../../lib/dates';
import { matchesSearch } from '../../lib/filters';
import {
  FilterPanel,
  FilterSelect,
  Statistics,
  QuickFilters,
} from '../../components/Explore';
import { useExplore } from '../../i18n/explore';
import { sortTasks, taskListOccurrences, type Task } from './model';
import { useTasks, useTaskAction } from './queries';
import { TaskForm } from './TaskForm';

export function TaskList({
  tasks,
  preserveOrder = false,
}: {
  tasks: Task[];
  preserveOrder?: boolean;
}) {
  const { t, locale } = useI18n();
  const explore = useExplore();
  const online = useOnline();
  const action = useTaskAction();
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const today = localDate();
  return (
    <>
      {action.isError && <Banner alert>{t('actionError')}</Banner>}
      {(preserveOrder ? tasks : sortTasks(tasks)).map((task) => (
        <Card
          key={`${task.id}:${task.occurrence_on || 'once'}`}
          className={`task-row ${task.completed_at ? 'completed' : ''}`}
        >
          <div className="task-row-main">
            <h3>{task.title}</h3>
            <div className="task-meta">
              <Chip
                size="small"
                icon={<Icon name="clock" size={16} />}
                label={
                  task.due_on
                    ? `${task.due_on === today ? t('today') : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Lisbon' }).format(dayBounds(task.due_on)[0])}${task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ''}`
                    : t('taskNoDate')
                }
              />
              {!task.completed_at && task.due_on && task.due_on < today && (
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  label={t('taskOverdue')}
                />
              )}
              {task.rrule && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={explore.recurring}
                />
              )}
              {task.completed_at && (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={t('taskCompleted')}
                />
              )}
            </div>
            {task.notes && <p className="task-notes">{task.notes}</p>}
          </div>
          <div className="actions task-actions">
            <Button
              disabled={!online || action.isPending}
              onClick={() => action.mutate({ kind: 'complete', task })}
            >
              <Icon name="check" />
              {t(task.completed_at ? 'undo' : 'taskComplete')}
            </Button>
            <Button
              variant="secondary"
              disabled={!online || action.isPending}
              onClick={() => setEditing(task)}
            >
              <Icon name="edit" size={18} />
              {t('edit')}
            </Button>
            {task.rrule && task.occurrence_on && !task.completed_at && (
              <Button
                variant="secondary"
                disabled={!online || action.isPending}
                onClick={() => action.mutate({ kind: 'skip', task })}
              >
                {t('repeatSkip')}
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={!online || action.isPending}
              onClick={() => {
                action.reset();
                setDeleting(task);
              }}
            >
              <Icon name="trash" size={18} />
              {t('delete')}
            </Button>
          </div>
        </Card>
      ))}
      {editing && (
        <Modal title={t('taskEdit')} onClose={() => setEditing(null)}>
          <TaskForm task={editing} onSaved={() => setEditing(null)} />
        </Modal>
      )}
      {deleting && (
        <Modal
          title={t('taskDelete')}
          busy={action.isPending}
          onClose={() => setDeleting(null)}
        >
          <p>{deleting.title}</p>
          <p>{t(deleting.rrule ? 'repeatDeleteHelp' : 'taskDeleteHelp')}</p>
          {action.isError && <Banner alert>{t('actionError')}</Banner>}
          <div className="actions">
            <Button
              variant="danger"
              disabled={!online || action.isPending}
              onClick={() =>
                action.mutate(
                  { kind: 'delete', id: deleting.id },
                  { onSuccess: () => setDeleting(null) },
                )
              }
            >
              {t('delete')}
            </Button>
            <Button
              variant="secondary"
              disabled={action.isPending}
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

export function Tasks() {
  const { t } = useI18n();
  const query = useTasks();
  const explore = useExplore();
  const today = localDate();
  const [period, setPeriod] = useState('all');
  const [recurrence, setRecurrence] = useState('all');
  const [sort, setSort] = useState('soonest');
  const [visibleCount, setVisibleCount] = useState(50);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [editingSeries, setEditingSeries] = useState<Task | null>(null);
  const tasks = sortTasks(
    taskListOccurrences(
      query.data?.tasks || [],
      query.data?.completions || [],
      today,
    ).filter(
      (task) =>
        matchesSearch(`${task.title} ${task.notes}`, search) &&
        (filter === 'all' ||
          (filter === 'completed'
            ? !!task.completed_at
            : !task.completed_at)) &&
        (period === 'all' ||
          (period === 'none'
            ? !task.due_on
            : period === 'today'
              ? task.due_on === today
              : period === 'overdue'
                ? !!task.due_on && task.due_on < today
                : !!task.due_on && task.due_on > today)) &&
        (recurrence === 'all' ||
          (recurrence === 'recurring' ? !!task.rrule : !task.rrule)),
    ),
  );
  if (sort === 'name') tasks.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'newest')
    tasks.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const reset = () => {
    setFilter('pending');
    setSearch('');
    setPeriod('all');
    setRecurrence('all');
    setSort('soonest');
    setVisibleCount(50);
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('tasks')}</h1>
          <p>{t('taskHelp')}</p>
        </div>
        <Link className="button" to="/add/task">
          <Icon name="plus" />
          {t('taskNew')}
        </Link>
      </header>
      <FilterPanel
        count={
          Number(!!search) +
          Number(filter !== 'pending') +
          Number(period !== 'all') +
          Number(recurrence !== 'all') +
          Number(sort !== 'soonest')
        }
        onReset={reset}
        onSearchClear={() => setSearch('')}
        results={query.data?.available ? tasks.length : undefined}
        quickFilters={
          <QuickFilters
            label={explore.status}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setVisibleCount(50);
            }}
            options={[
              ['pending', t('taskPending')],
              ['completed', t('taskCompleted')],
              ['all', t('taskAll')],
            ]}
          />
        }
      >
        <TextField
          fullWidth
          type="search"
          label={t('taskSearch')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(50);
          }}
        />
        <FilterSelect
          label={explore.period}
          value={period}
          onChange={(value) => {
            setPeriod(value);
            setVisibleCount(50);
          }}
          options={[
            ['all', explore.allDates],
            ['today', t('today')],
            ['overdue', t('taskOverdue')],
            ['upcoming', t('taskUpcoming')],
            ['none', t('taskNoDate')],
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
            ['name', explore.name],
            ['newest', explore.newest],
          ]}
        />
      </FilterPanel>
      {query.data?.available && (
        <div className="tasks-summary">
          <Statistics
            label={t('taskSummary')}
            items={[
              { label: t('taskMatches'), value: tasks.length, icon: 'check' },
              {
                label: t('today'),
                value: tasks.filter(
                  (task) => !task.completed_at && task.due_on === today,
                ).length,
                icon: 'calendar',
              },
              {
                label: t('taskOverdue'),
                value: tasks.filter(
                  (task) =>
                    !task.completed_at && task.due_on && task.due_on < today,
                ).length,
                icon: 'clock',
              },
              {
                label: t('taskNoDate'),
                value: tasks.filter((task) => !task.due_on).length,
                icon: 'check',
              },
            ]}
          />
        </div>
      )}
      {query.isPending && <Spinner />}
      {query.isError && (
        <Banner alert>
          {t('error')}
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </Banner>
      )}
      {query.data?.available === false && <Banner>{t('taskSetup')}</Banner>}
      {query.data?.available &&
        (tasks.length ? (
          <TaskList tasks={tasks.slice(0, visibleCount)} preserveOrder />
        ) : (
          <EmptyState title={t('taskEmpty')} help={t('taskEmptyHelp')} />
        ))}
      {tasks.length > visibleCount && (
        <Button
          variant="secondary"
          onClick={() => setVisibleCount(visibleCount + 50)}
        >
          {t('taskMore')}
        </Button>
      )}
      {query.data?.tasks.some((task) => task.rrule) && (
        <details className="completed-doses">
          <summary>{t('repeatSchedules')}</summary>
          {query.data.tasks
            .filter((task) => task.rrule)
            .map((task) => (
              <Card key={task.id}>
                <strong>{task.title}</strong>
                <div className="actions">
                  <Button
                    variant="secondary"
                    onClick={() => setEditingSeries(task)}
                  >
                    {t('wholeSeries')}
                  </Button>
                </div>
              </Card>
            ))}
        </details>
      )}
      {editingSeries && (
        <Modal title={t('taskEdit')} onClose={() => setEditingSeries(null)}>
          <TaskForm
            task={editingSeries}
            onSaved={() => setEditingSeries(null)}
          />
        </Modal>
      )}
    </>
  );
}
