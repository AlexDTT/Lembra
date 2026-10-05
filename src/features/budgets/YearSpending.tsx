import { Card, Button } from '../../components/ui';
import { InsightChart } from '../../components/InsightChart';
import { useI18n } from '../../i18n/context';
import { useMoneyCopy } from '../../i18n/money';
import { yearlySpending } from '../../lib/insights';
import { formatMoney } from '../../lib/money';

export function YearSpending({
  rows,
  year,
  onMonth,
}: {
  rows: { amount: number; spent_on: string }[];
  year: string;
  onMonth: (month: string) => void;
}) {
  const { t, locale } = useI18n();
  const copy = useMoneyCopy();
  const monthly = yearlySpending(rows, year);
  const label = (month: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${month}-01T12:00:00Z`));
  return (
    <Card className="insight-panel">
      <h2>{copy.yearSpending}</h2>
      <p>{copy.yearChartHelp}</p>
      <InsightChart
        title={copy.yearSpending}
        money
        labels={monthly.map((item) => label(item.key))}
        series={[
          {
            name: t('expenses'),
            values: monthly.map((item) => item.cents),
            color: '#176b5b',
          },
        ]}
      />
      <div className="money-month-grid">
        {monthly.map((item) => (
          <Button
            key={item.key}
            variant="secondary"
            onClick={() => onMonth(item.key)}
          >
            <span>{label(item.key)}</span>
            <strong>{formatMoney(item.cents, locale)}</strong>
          </Button>
        ))}
      </div>
    </Card>
  );
}
