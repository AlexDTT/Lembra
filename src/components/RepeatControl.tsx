import { Checkbox, FormControlLabel } from '@mui/material';
import { useI18n } from '../i18n/context';
import { Banner, Button, Field } from './ui';
import { localInstant } from '../lib/dates';
import {
  repeatOptions,
  repeatPreview,
  repeatRule,
  weekdays,
  type RepeatOptions,
} from '../lib/repeat';

export function RepeatControl({
  value,
  day,
  time = '09:00',
  timezone = 'Europe/Lisbon',
  onChange,
}: {
  value: string | null;
  day: string;
  time?: string;
  timezone?: string;
  onChange: (value: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const options = repeatOptions(value, day, timezone);
  const change = (next: Partial<RepeatOptions>) => {
    try {
      onChange(repeatRule({ ...options, ...next }, timezone));
    } catch {
      /* Invalid dates remain editable. */
    }
  };
  const dayLabels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const toggle = <T,>(values: T[], item: T) =>
    values.includes(item)
      ? values.length === 1
        ? values
        : values.filter((value) => value !== item)
      : [...values, item];
  let preview: Date[] = [];
  try {
    if (value && options.interval > 0 && options.count > 0)
      preview = repeatPreview({
        starts_at: localInstant(day, time, timezone).toISOString(),
        rrule: value,
        timezone,
      });
  } catch {
    /* Show the validation message below. */
  }
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, i, 1)),
    ),
  );
  return (
    <fieldset className="repeat-control">
      <Field label={t('repeat')}>
        <select
          value={options.frequency}
          disabled={!day}
          onChange={(e) =>
            change({ frequency: e.target.value as RepeatOptions['frequency'] })
          }
        >
          <option value="once">{t('once')}</option>
          <option value="DAILY">{t('repeatDaily')}</option>
          <option value="WEEKLY">{t('repeatWeekly')}</option>
          <option value="MONTHLY">{t('repeatMonthly')}</option>
          <option value="YEARLY">{t('repeatYearly')}</option>
        </select>
      </Field>
      {!day && <p className="form-hint">{t('repeatNeedsDate')}</p>}
      {options.frequency !== 'once' && (
        <>
          <Field
            label={`${t('repeatEvery')} (${t(options.frequency === 'DAILY' ? 'repeatDays' : options.frequency === 'WEEKLY' ? 'repeatWeeks' : options.frequency === 'MONTHLY' ? 'repeatMonths' : 'repeatYears')})`}
          >
            <input
              type="number"
              min={1}
              max={366}
              required
              value={options.interval || ''}
              onChange={(e) => change({ interval: Number(e.target.value) })}
            />
          </Field>
          {options.frequency === 'YEARLY' && (
            <fieldset>
              <legend>{t('repeatSelectedMonths')}</legend>
              <div className="repeat-choices">
                {months.map((label, i) => (
                  <FormControlLabel
                    key={i}
                    label={label}
                    control={
                      <Checkbox
                        checked={options.months.includes(i + 1)}
                        onChange={() =>
                          change({ months: toggle(options.months, i + 1) })
                        }
                      />
                    }
                  />
                ))}
              </div>
            </fieldset>
          )}
          {(options.frequency === 'MONTHLY' ||
            options.frequency === 'YEARLY') && (
            <>
              <Field label={t('repeatPattern')}>
                <select
                  value={options.mode}
                  onChange={(e) =>
                    change({
                      mode: e.target.value as RepeatOptions['mode'],
                      dates: options.dates.length
                        ? options.dates
                        : [Number(day.slice(-2))],
                    })
                  }
                >
                  <option value="dates">{t('repeatDates')}</option>
                  <option value="weekday">{t('repeatWeekday')}</option>
                  <option value="last">{t('repeatMonthEnd')}</option>
                  <option value="week">{t('repeatWeek')}</option>
                </select>
              </Field>
              {options.mode === 'dates' && (
                <>
                  <div className="repeat-date-grid">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => (
                      <Button
                        key={date}
                        variant={
                          options.dates.includes(date) ? 'primary' : 'secondary'
                        }
                        aria-pressed={options.dates.includes(date)}
                        onClick={() =>
                          change({ dates: toggle(options.dates, date) })
                        }
                      >
                        {date}
                      </Button>
                    ))}
                  </div>
                  <p className="form-hint">{t('repeatShortMonth')}</p>
                </>
              )}
              {options.mode === 'weekday' && (
                <Field label={t('repeatOrdinal')}>
                  <select
                    value={options.ordinal}
                    onChange={(e) =>
                      change({ ordinal: Number(e.target.value) })
                    }
                  >
                    {([1, 2, 3, 4, 5, -1] as const).map((n, i) => (
                      <option key={n} value={n}>
                        {t(
                          (
                            [
                              'repeatFirst',
                              'repeatSecond',
                              'repeatThird',
                              'repeatFourth',
                              'repeatFifth',
                              'repeatLast',
                            ] as const
                          )[i],
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {options.mode === 'last' && (
                <Field label={t('repeatOffset')}>
                  <input
                    type="number"
                    min={0}
                    max={27}
                    required
                    value={options.offset}
                    onChange={(e) => change({ offset: Number(e.target.value) })}
                  />
                </Field>
              )}
              {options.mode === 'week' && (
                <>
                  <Field label={t('repeatWeek')}>
                    <select
                      value={options.week}
                      onChange={(e) => change({ week: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="form-hint">{t('repeatWeekHelp')}</p>
                </>
              )}
            </>
          )}
          {(options.frequency === 'WEEKLY' ||
            ((options.frequency === 'MONTHLY' ||
              options.frequency === 'YEARLY') &&
              ['weekday', 'week'].includes(options.mode))) && (
            <fieldset>
              <legend>{t('repeatOn')}</legend>
              <div className="repeat-choices">
                {weekdays.map((day, i) => (
                  <FormControlLabel
                    key={day}
                    label={t(dayLabels[i])}
                    control={
                      <Checkbox
                        checked={options.days.includes(day)}
                        onChange={() =>
                          change({ days: toggle(options.days, day) })
                        }
                      />
                    }
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={() => change({ days: weekdays.slice(0, 5) })}
              >
                {t('repeatWeekdays')}
              </Button>
            </fieldset>
          )}
          <Field label={t('repeatEnd')}>
            <select
              value={options.end}
              onChange={(e) =>
                change({
                  end: e.target.value as RepeatOptions['end'],
                  until: options.until || day,
                })
              }
            >
              <option value="never">{t('repeatNever')}</option>
              <option value="until">{t('repeatUntil')}</option>
              <option value="count">{t('repeatCount')}</option>
            </select>
          </Field>
          {options.end === 'until' && (
            <Field label={t('endDate')}>
              <input
                type="date"
                required
                min={day}
                value={options.until}
                onChange={(e) => change({ until: e.target.value })}
              />
            </Field>
          )}
          {options.end === 'count' && (
            <Field label={t('repeatOccurrences')}>
              <input
                type="number"
                required
                min={1}
                max={10000}
                value={options.count || ''}
                onChange={(e) => change({ count: Number(e.target.value) })}
              />
            </Field>
          )}
          {preview.length ? (
            <div className="schedule-preview card">
              <h3>{t('repeatPreview')}</h3>
              <ol>
                {preview.map((date) => (
                  <li key={date.toISOString()}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: timezone,
                    }).format(date)}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <Banner alert>{t('repeatInvalid')}</Banner>
          )}
        </>
      )}
    </fieldset>
  );
}
