import { matchesExpense, type ExpenseFilters } from '../../lib/filters';
import type { Tables } from '../../types/database';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, Spinner } from '../../components/ui';
import { InsightChart } from '../../components/InsightChart';
import { supabase } from '../../lib/supabase';
import { fetchAll } from '../../lib/pagination';
import { shiftMonth, spendingSeries } from '../../lib/insights';

export function MoneyInsights({
  month,
  filters,
  categories,
}: {
  month: string;
  filters: ExpenseFilters;
  categories: Tables<'categories'>[];
}) {
  const { session } = useAuth();
  const { t, locale } = useI18n();
  const query = useQuery({
    queryKey: ['expenses', session!.user.id, 'insights', month],
    queryFn: ({ signal }) =>
      fetchAll((from, to) =>
        supabase
          .from('expenses')
          .select('amount,spent_on,id,category_id,completion_id,note')
          .eq('user_id', session!.user.id)
          .gte('spent_on', `${shiftMonth(month, -5)}-01`)
          .lt('spent_on', `${shiftMonth(month, 1)}-01`)
          .order('id')
          .range(from, to)
          .abortSignal(signal),
      ),
  });
  const selected = (query.data || []).filter((row) =>
    matchesExpense(
      row,
      filters,
      categories.find((category) => category.id === row.category_id)?.name ||
        t('uncategorized'),
    ),
  );
  const values = spendingSeries(selected, month);
  if (query.isPending) return <Spinner />;
  if (query.isError)
    return (
      <Banner alert>
        {t('error')}{' '}
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </Banner>
    );
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`${key}-01T12:00:00Z`));
  return (
    <section aria-label={t('financialInsights')}>
      <div className="section-intro">
        <h2>{t('financialInsights')}</h2>
        <p>{t('recordedExpensesOnly')}</p>
      </div>
      <div className="insight-grid">
        <Card className="insight-panel">
          <header>
            <h3>{t('sixMonthSpending')}</h3>
            <p>{t('sixMonthHelp')}</p>
          </header>
          {selected.length ? (
            <InsightChart
              title={t('sixMonthSpending')}
              money
              labels={values.monthly.map((item) => monthLabel(item.key))}
              series={[
                {
                  name: t('expenses'),
                  values: values.monthly.map((item) => item.cents),
                  color: '#176b5b',
                },
              ]}
            />
          ) : (
            <p className="chart-empty">{t('notEnoughExpenses')}</p>
          )}
        </Card>
        <Card className="insight-panel">
          <header>
            <h3>{t('cumulativeSpending')}</h3>
            <p>{monthLabel(month)}</p>
          </header>
          {selected.some((row) => row.spent_on.startsWith(month)) ? (
            <InsightChart
              title={t('cumulativeSpending')}
              money
              line
              labels={values.cumulative.map((item) => item.key.slice(-2))}
              series={[
                {
                  name: t('spent'),
                  values: values.cumulative.map((item) => item.cents),
                  color: '#176b5b',
                },
              ]}
            />
          ) : (
            <p className="chart-empty">{t('emptyExpenses')}</p>
          )}
        </Card>
      </div>
    </section>
  );
}
