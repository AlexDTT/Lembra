import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, Field } from '../../components/ui';
import { useFormPending } from '../../components/modal-context';
import { useOnline } from '../../lib/network';
import { taskSchema, type Task } from './model';
import { useTaskAction, useTasks } from './queries';
import { RepeatControl } from '../../components/RepeatControl';

export function TaskForm({
  task,
  onSaved,
}: {
  task?: Task;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const online = useOnline();
  const action = useTaskAction();
  const tasks = useTasks();
  const [pending, setPending] = useFormPending();
  const [scope, setScope] = useState<'single' | 'future' | 'series'>(
    task?.occurrence_on ? 'single' : 'series',
  );
  const [invalid, setInvalid] = useState(false);
  const [input, setInput] = useState({
    rrule: task?.rrule || null,
    excluded_dates: task?.excluded_dates || [],
    title: task?.title || '',
    notes: task?.notes || '',
    due_on: task?.due_on || '',
    due_time: task?.due_time?.slice(0, 5) || '',
  });
  const finish = () => (onSaved ? onSaved() : navigate('/tasks'));
  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = taskSchema.safeParse({
            ...input,
            rrule: scope === 'single' ? null : input.rrule,
          });
          setInvalid(!parsed.success);
          if (!parsed.success || pending) return;
          setPending(true);
          action.mutate(
            {
              kind: 'save',
              input: parsed.data,
              id: task?.id,
              occurrence: task?.occurrence_on,
              scope,
            },
            {
              onSuccess: finish,
              onSettled: () => setPending(false),
            },
          );
        }}
      >
        <fieldset disabled={pending}>
          {task?.rrule && task.occurrence_on && (
            <>
              <Field label={t('editScope')}>
                <select
                  value={scope}
                  onChange={(e) => {
                    const next = e.target.value as typeof scope;
                    setScope(next);
                    setInput({
                      ...input,
                      due_on:
                        next === 'series'
                          ? task.original_due_on || task.due_on || ''
                          : task.occurrence_on!,
                      rrule: task.rrule,
                    });
                  }}
                >
                  <option value="single">{t('thisOccurrence')}</option>
                  <option value="future">{t('repeatFuture')}</option>
                  <option value="series">{t('wholeSeries')}</option>
                </select>
              </Field>
              <p className="form-hint">{t('repeatHistory')}</p>
            </>
          )}

          <Field label={t('taskTitle')}>
            <input
              required
              maxLength={120}
              value={input.title}
              onChange={(e) => setInput({ ...input, title: e.target.value })}
            />
          </Field>
          <Field label={t('notes')}>
            <textarea
              maxLength={2000}
              value={input.notes}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label={t('taskDue')}>
              <input
                type="date"
                value={input.due_on}
                onChange={(e) =>
                  setInput({
                    ...input,
                    due_on: e.target.value,
                    due_time: e.target.value ? input.due_time : '',
                    rrule: e.target.value ? input.rrule : null,
                  })
                }
              />
            </Field>
            <Field label={t('taskTime')}>
              <input
                type="time"
                value={input.due_time}
                disabled={!input.due_on}
                onChange={(e) =>
                  setInput({ ...input, due_time: e.target.value })
                }
              />
            </Field>
          </div>
          {scope !== 'single' && (
            <RepeatControl
              value={input.rrule}
              day={input.due_on}
              time={input.due_time || '00:00'}
              onChange={(rrule) => setInput({ ...input, rrule })}
            />
          )}
          {scope === 'series' && input.excluded_dates.length > 0 && (
            <fieldset>
              <legend>{t('repeatExceptions')}</legend>
              {input.excluded_dates.map((day) => (
                <p key={day}>
                  {day}{' '}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setInput({
                        ...input,
                        excluded_dates: input.excluded_dates.filter(
                          (date) => date !== day,
                        ),
                      })
                    }
                  >
                    {t('undo')}
                  </Button>
                </p>
              ))}
            </fieldset>
          )}
        </fieldset>
        {invalid && <Banner alert>{t('taskValidation')}</Banner>}
        {tasks.data?.available === false && <Banner>{t('taskSetup')}</Banner>}
        {action.isError && <Banner alert>{t('saveError')}</Banner>}
        <div className="actions">
          <Button
            type="submit"
            disabled={pending || !online || tasks.data?.available === false}
          >
            {t(pending ? 'saving' : 'save')}
          </Button>
          <Button variant="secondary" onClick={finish} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function AddTask() {
  const { t } = useI18n();
  return (
    <div className="form-page">
      <header className="page-heading">
        <h1>{t('taskNew')}</h1>
      </header>
      <TaskForm />
    </div>
  );
}
