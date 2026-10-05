import { useId, useState } from 'react';
import { Popover } from '@mui/material';
import { Button, Field } from '../../components/ui';
import { SelectField } from '../../components/SelectField';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/context';
import { localDate } from '../../lib/dates';

export function CalendarDatePicker({
  selected,
  label,
  onChange,
}: {
  selected: string;
  label: string;
  onChange: (day: string) => void;
}) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState(selected);
  const year = draft.slice(0, 4) || selected.slice(0, 4);
  const select = (day: string) => {
    onChange(day);
    setAnchor(null);
  };
  const inMonth = (month: string) => {
    const last = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    ).getUTCDate();
    return `${month}-${String(Math.min(Number((draft || selected).slice(-2)), last)).padStart(2, '0')}`;
  };
  const lastYear = Math.max(
    2100,
    Number(selected.slice(0, 4)),
    Number(localDate().slice(0, 4)) + 10,
  );
  return (
    <>
      <Button
        variant="secondary"
        className="calendar-date-trigger"
        aria-label={`${t('calendarChooseDate')}: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => {
          setDraft(selected);
          setAnchor(event.currentTarget);
        }}
      >
        <span>{label}</span>
        <Icon name="chevron" size={18} style={{ transform: 'rotate(90deg)' }} />
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            className: 'money-period-picker',
          },
        }}
      >
        <h2 id={titleId}>{t('calendarChooseDate')}</h2>
        <SelectField
          label={t('calendarYear')}
          value={year}
          autoFocus
          onChange={(event) =>
            setDraft(
              inMonth(
                `${event.target.value}${(draft || selected).slice(4, 7)}`,
              ),
            )
          }
          options={Array.from({ length: lastYear - 1899 }, (_, i) => ({
            value: String(lastYear - i),
            label: String(lastYear - i),
          }))}
        />
        <div className="money-picker-months">
          {Array.from({ length: 12 }, (_, i) => {
            const month = `${year}-${String(i + 1).padStart(2, '0')}`;
            const name = new Intl.DateTimeFormat(locale, {
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${month}-01T12:00:00Z`));
            return (
              <Button
                key={month}
                variant={selected.startsWith(month) ? 'primary' : 'secondary'}
                aria-label={`${name} ${year}`}
                onClick={() => select(inMonth(month))}
              >
                {name}
              </Button>
            );
          })}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (/^\d{4}-\d{2}-\d{2}$/.test(draft)) select(draft);
          }}
        >
          <Field label={t('date')}>
            <input
              type="date"
              required
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <div className="actions">
            <Button type="submit" disabled={!draft}>
              {t('calendarGo')}
            </Button>
            <Button variant="secondary" onClick={() => select(localDate())}>
              {t('today')}
            </Button>
          </div>
        </form>
      </Popover>
    </>
  );
}
