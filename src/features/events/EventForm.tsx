import { Checkbox, FormControlLabel } from '@mui/material';
import { useCopy } from '../../i18n/ux';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, Field } from '../../components/ui';
import { useFormPending } from '../../components/modal-context';
import { localDate, localInstant, localTime } from '../../lib/dates';
import { decimalAmount, parseCents } from '../../lib/money';
import { useCareBackend } from '../../lib/backend';
import { useOnline } from '../../lib/network';
import type { EventRow } from '../../types/domain';
import { useCategories, useEventActions } from './queries';
import { RepeatControl } from '../../components/RepeatControl';
import { validateRepeat, repeatPreview } from '../../lib/repeat';

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().max(300),
  notes: z.string().trim().max(2000),
  category: z.string(),
  expenseCategory: z.string(),
  amount: z.string(),
  reminders: z.array(z.number().int().min(0).max(10080)).min(1).max(5),
  duration: z.number().int().min(5).max(1440),
});
export function EventForm({
  type,
  event,
  occurrence,
  onClose,
}: {
  type: 'appointment' | 'bill';
  event?: EventRow;
  occurrence?: Date;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const copy = useCopy();
  const navigate = useNavigate();
  const categories = useCategories();
  const { save } = useEventActions();
  const online = useOnline();
  const backend = useCareBackend();
  const [scope, setScope] = useState<'series' | 'single' | 'future'>('series');
  const [excludedDates, setExcludedDates] = useState(
    event?.excluded_dates || [],
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [input, setInput] = useState({
    title: event?.title || '',
    duration: event?.ends_at
      ? Math.round(
          (new Date(event.ends_at).getTime() -
            new Date(event.starts_at).getTime()) /
            60000,
        )
      : 30,
    date: event
      ? localDate(new Date(event.starts_at), event.timezone)
      : localDate(),
    time: event ? localTime(event.starts_at, event.timezone) : '09:00',
    location: event?.location || '',
    notes: event?.notes || '',
    rrule: event?.rrule || null,
    category: event?.category_id || '',
    expenseCategory: event?.expense_category_id || '',
    amount: event?.amount?.toFixed(2) || '',
    reminders:
      event?.reminder_minutes || (type === 'bill' ? [4320, 0] : [1440, 60]),
  });
  const [pending, setPending] = useFormPending();
  const [error, setError] = useState<'generalValidation' | 'saveError' | null>(
    null,
  );
  const finish = () =>
    onClose
      ? onClose()
      : navigate(type === 'bill' ? '/bills' : '/appointments');
  return (
    <Card>
      <form
        className="care-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setFieldErrors({});
          const parsed = schema.safeParse(input);
          if (!parsed.success) {
            setFieldErrors(
              Object.fromEntries(
                parsed.error.issues.map((issue) => [
                  String(issue.path[0]),
                  t('checkField'),
                ]),
              ),
            );
            setError('generalValidation');
            return;
          }
          let starts: Date,
            cents = 0;
          try {
            starts = localInstant(
              input.date,
              type === 'bill' ? '09:00' : input.time,
              event?.timezone,
            );
            if (type === 'bill') cents = parseCents(input.amount);
            validateRepeat(
              scope === 'single' ? null : input.rrule,
              starts.toISOString(),
              event?.timezone,
            );
            if (scope !== 'single' && input.rrule)
              starts = repeatPreview({
                starts_at: starts.toISOString(),
                rrule: input.rrule,
                timezone: event?.timezone || 'Europe/Lisbon',
              })[0];
          } catch {
            setFieldErrors({
              [type === 'bill' ? 'amount' : 'time']:
                type === 'bill' ? t('amountRequired') : t('checkField'),
            });
            setError('generalValidation');
            return;
          }
          setPending(true);
          void save(
            {
              type,
              title: parsed.data.title,
              starts_at: starts.toISOString(),
              timezone: event?.timezone || 'Europe/Lisbon',
              ends_at:
                type === 'appointment'
                  ? new Date(
                      starts.getTime() + input.duration * 60000,
                    ).toISOString()
                  : null,
              all_day: type === 'bill',
              location: input.location || null,
              notes: input.notes || null,
              category_id: input.category || null,
              expense_category_id:
                type === 'bill' ? input.expenseCategory || null : null,
              amount: type === 'bill' ? decimalAmount(cents) : null,
              reminder_minutes: parsed.data.reminders,
              rrule: scope === 'single' ? null : input.rrule,
              active: true,
              excluded_dates: scope === 'series' ? excludedDates : [],
            },
            event?.id,
            scope !== 'series' ? occurrence : undefined,
            scope === 'future' ? 'future' : 'single',
          )
            .then(finish)
            .catch(() => setError('saveError'))
            .finally(() => setPending(false));
        }}
      >
        {event?.rrule && occurrence && (
          <Field label={t('editScope')}>
            <select
              value={scope}
              onChange={(e) => {
                const next = e.target.value as 'series' | 'single' | 'future';
                setScope(next);
                setInput({
                  ...input,
                  date: localDate(
                    next !== 'series' ? occurrence : new Date(event.starts_at),
                    event.timezone,
                  ),
                  time: localTime(
                    next !== 'series' ? occurrence : new Date(event.starts_at),
                    event.timezone,
                  ),
                });
              }}
            >
              <option value="series">{t('wholeSeries')}</option>
              <option value="future">{t('repeatFuture')}</option>
              <option value="single" disabled={backend.data !== true}>
                {t('thisOccurrence')}
              </option>
            </select>
          </Field>
        )}
        {event?.rrule && backend.data === false && (
          <Banner>{t('featureSetup')}</Banner>
        )}
        {scope === 'series' && event?.rrule && type === 'appointment' && (
          <p>{t('seriesHelp')}</p>
        )}
        <Field
          label={t(type === 'bill' ? 'billTitle' : 'appointmentTitle')}
          error={fieldErrors.title}
        >
          <input
            required
            maxLength={120}
            value={input.title}
            onChange={(e) => setInput({ ...input, title: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field
            label={t(type === 'bill' ? 'dueDate' : 'date')}
            error={fieldErrors.date}
          >
            <input
              type="date"
              required
              value={input.date}
              onChange={(e) => setInput({ ...input, date: e.target.value })}
            />
          </Field>
          {type === 'appointment' ? (
            <Field label={t('time')} error={fieldErrors.time}>
              <input
                type="time"
                required
                value={input.time}
                onChange={(e) => setInput({ ...input, time: e.target.value })}
              />
            </Field>
          ) : (
            <Field label={t('amount')} error={fieldErrors.amount}>
              <input
                required
                inputMode="decimal"
                value={input.amount}
                onChange={(e) => setInput({ ...input, amount: e.target.value })}
              />
            </Field>
          )}
        </div>
        {type === 'appointment' && (
          <Field label={t('duration')} error={fieldErrors.duration}>
            <input
              type="number"
              min={5}
              max={1440}
              required
              value={Number.isNaN(input.duration) ? '' : input.duration}
              onChange={(e) =>
                setInput({
                  ...input,
                  duration:
                    e.target.value === '' ? NaN : Number(e.target.value),
                })
              }
            />
          </Field>
        )}
        {type === 'appointment' && (
          <Field label={t('place')}>
            <input
              maxLength={300}
              value={input.location}
              onChange={(e) => setInput({ ...input, location: e.target.value })}
            />
          </Field>
        )}
        <details className="form-details">
          <summary>
            {copy.details} · {copy.optional}
          </summary>
          <Field label={t('category')}>
            <select
              value={input.category}
              onChange={(e) => setInput({ ...input, category: e.target.value })}
            >
              <option value="">{t('uncategorized')}</option>
              {categories.data
                ?.filter((c) => c.kind === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          {type === 'bill' && (
            <Field label={t('expenseCategory')}>
              <select
                value={input.expenseCategory}
                onChange={(e) =>
                  setInput({ ...input, expenseCategory: e.target.value })
                }
              >
                <option value="">{t('uncategorized')}</option>
                {categories.data
                  ?.filter((c) => c.kind === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {categories.isError && <Banner alert>{t('error')}</Banner>}
          <Field label={t('notes')}>
            <textarea
              maxLength={2000}
              value={input.notes}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
            />
          </Field>
        </details>
        {scope !== 'single' && (
          <RepeatControl
            value={input.rrule}
            day={input.date}
            time={type === 'bill' ? '09:00' : input.time}
            timezone={event?.timezone}
            onChange={(rrule) => setInput({ ...input, rrule })}
          />
        )}

        {scope === 'series' && excludedDates.length > 0 && (
          <fieldset>
            <legend>{t('repeatExceptions')}</legend>
            {excludedDates.map((date) => (
              <p key={date}>
                {localDate(new Date(date), event?.timezone)}{' '}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setExcludedDates(
                      excludedDates.filter((value) => value !== date),
                    )
                  }
                >
                  {t('undo')}
                </Button>
              </p>
            ))}
          </fieldset>
        )}
        <fieldset>
          <legend>{copy.reminderOptions}</legend>
          <p className="form-hint">{copy.reminderHelp}</p>
          {fieldErrors.reminders && (
            <Banner alert>{fieldErrors.reminders}</Banner>
          )}
          <div className="reminder-options">
            {[
              ...new Set([
                0,
                60,
                1440,
                ...(type === 'bill' ? [4320] : []),
                ...input.reminders,
              ]),
            ]
              .sort((a, b) => a - b)
              .map((minutes) => (
                <FormControlLabel
                  key={minutes}
                  control={
                    <Checkbox
                      checked={input.reminders.includes(minutes)}
                      onChange={(_, checked) =>
                        setInput({
                          ...input,
                          reminders: checked
                            ? [...input.reminders, minutes]
                            : input.reminders.filter(
                                (value) => value !== minutes,
                              ),
                        })
                      }
                    />
                  }
                  label={
                    minutes === 0
                      ? copy.atTime
                      : minutes === 60
                        ? copy.hourBefore
                        : minutes === 1440
                          ? copy.dayBefore
                          : minutes === 4320
                            ? copy.threeDaysBefore
                            : `${minutes} min`
                  }
                />
              ))}
          </div>
        </fieldset>
        {error && <Banner alert>{t(error)}</Banner>}
        <div className="actions">
          <Button type="submit" disabled={pending || !online}>
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
export function AddEvent({ type }: { type: 'appointment' | 'bill' }) {
  const { t } = useI18n();
  return (
    <div className="form-page">
      <header className="page-heading">
        <h1>{t(type === 'bill' ? 'billNew' : 'appointmentNew')}</h1>
      </header>
      <EventForm type={type} />
    </div>
  );
}
