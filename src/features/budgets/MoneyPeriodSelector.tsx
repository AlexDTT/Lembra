import { useId, useState } from 'react';
import { Popover } from '@mui/material';
import { SelectField } from '../../components/SelectField';
import { Button } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/context';
import { useMoneyCopy } from '../../i18n/money';

export function MoneyPeriodSelector({
  month,
  view,
  currentMonth,
  disabled,
  onChange,
}: {
  month: string;
  view: 'month' | 'year';
  currentMonth: string;
  disabled: boolean;
  onChange: (month: string, view: 'month' | 'year') => void;
}) {
  const { locale } = useI18n();
  const copy = useMoneyCopy();
  const titleId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [year, setYear] = useState(month.slice(0, 4));
  const currentYear = Number(currentMonth.slice(0, 4));
  const lastYear = Math.max(currentYear + 5, Number(month.slice(0, 4)));
  const years = Array.from({ length: lastYear - 1899 }, (_, index) =>
    String(lastYear - index),
  );
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`,
  );
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${key}-01T12:00:00Z`));
  const select = (next: string, nextView: 'month' | 'year') => {
    onChange(next, nextView);
    setAnchor(null);
  };
  return (
    <>
      <Button
        variant="secondary"
        className="money-period-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => {
          setYear(month.slice(0, 4));
          setAnchor(event.currentTarget);
        }}
      >
        <Icon name="calendar" />
        <span>
          {view === 'month'
            ? `${monthLabel(month)} ${month.slice(0, 4)}`
            : month.slice(0, 4)}
        </span>
        <Icon name="chevron" size={18} style={{ transform: 'rotate(90deg)' }} />
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            className: 'money-period-picker',
          },
        }}
      >
        <h2 id={titleId}>{copy.choosePeriod}</h2>
        <SelectField
          label={copy.year}
          value={year}
          autoFocus
          onChange={(event) => setYear(event.target.value)}
          options={years.map((value) => ({ value, label: value }))}
        />
        <div className="money-picker-months">
          {months.map((key) => (
            <Button
              key={key}
              variant={
                view === 'month' && month === key ? 'primary' : 'secondary'
              }
              aria-label={`${monthLabel(key)} ${year}`}
              aria-pressed={view === 'month' && month === key}
              onClick={() => select(key, 'month')}
            >
              {monthLabel(key)}
            </Button>
          ))}
        </div>
        <div className="money-picker-actions">
          <Button
            variant="secondary"
            onClick={() => select(`${year}${month.slice(4)}`, 'year')}
          >
            {copy.viewYear}
          </Button>
          <Button
            variant="secondary"
            onClick={() => select(currentMonth, 'month')}
          >
            {copy.currentMonth}
          </Button>
        </div>
      </Popover>
    </>
  );
}
