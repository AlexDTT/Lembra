import { SectionNavigation } from '../../components/SectionNavigation';
import { TextField } from '@mui/material';
import {
  FilterPanel,
  FilterSelect,
  Statistics,
  QuickFilters,
} from '../../components/Explore';
import { useExplore } from '../../i18n/explore';
import { matchesExpense, amountBounds } from '../../lib/filters';
import { useCopy } from '../../i18n/ux';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Spinner,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';
import {
  decimalAmount,
  formatMoney,
  parseCents,
  toCents,
} from '../../lib/money';
import { localDate, dayBounds } from '../../lib/dates';
import { useOnline } from '../../lib/network';
import {
  useBillCompletions,
  useEvents,
  useCategories,
} from '../events/queries';
import { ExpenseForm } from '../expenses/ExpenseForm';
import type { Tables } from '../../types/database';
import { SpendingChart } from './SpendingChart';
import { MoneyInsights } from './MoneyInsights';
import { occurrencesBetween } from '../../lib/recurrence';
import { fetchAll } from '../../lib/pagination';
import { moneyPeriod, yearlySpending } from '../../lib/insights';
import { useMoneyCopy } from '../../i18n/money';
import { YearSpending } from './YearSpending';
import { MoneyPeriodSelector } from './MoneyPeriodSelector';

export function Money() {
  const copy = useCopy();
  const explore = useExplore();
  const moneyCopy = useMoneyCopy();
  const [filterCategory, setFilterCategory] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const client = useQueryClient();
  const online = useOnline();
  const categories = useCategories();
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [view, setView] = useState<'month' | 'year'>('month');
  const currentMonth = localDate().slice(0, 7);
  const canEdit = view === 'month' && month === currentMonth;
  const period = moneyPeriod(month, view);
  const changePeriod = (nextMonth: string, nextView = view) => {
    if (pending) return;
    setMonth(nextMonth);
    setView(nextView);
    setEditing(null);
    setRepeating(null);
    setDeleting(null);
    setBudget(undefined);
    setError(false);
  };
  const [editing, setEditing] = useState<Tables<'expenses'> | null>(null);
  const [repeating, setRepeating] = useState<Tables<'expenses'> | null>(null);
  const bills = useEvents();
  const paidBills = useBillCompletions();
  const [deleting, setDeleting] = useState<Tables<'expenses'> | null>(null);
  const [budget, setBudget] = useState<Tables<'budgets'> | null | undefined>(
    undefined,
  );
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const expenses = useQuery({
    queryKey: ['expenses', session!.user.id, view, period.from],
    queryFn: async ({ signal }) => {
      return fetchAll((from, to) =>
        supabase
          .from('expenses')
          .select('*')
          .eq('user_id', session!.user.id)
          .gte('spent_on', period.from)
          .lt('spent_on', period.to)
          .order('spent_on', { ascending: false })
          .order('id')
          .range(from, to)
          .abortSignal(signal),
      );
    },
  });
  const budgets = useQuery({
    queryKey: ['budgets', session!.user.id],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', session!.user.id)
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  const [monthFrom] = dayBounds(period.from);
  const monthTo = new Date(dayBounds(period.to)[0].getTime() - 1);
  let invalidBills = false;
  const unpaid = (bills.data || [])
    .filter((e) => e.type === 'bill' && view === 'month')
    .flatMap((event) => {
      try {
        return occurrencesBetween(event, monthFrom, monthTo)
          .filter(
            (occurrence) =>
              !paidBills.data?.some(
                (c) =>
                  c.event_id === event.id &&
                  new Date(c.occurrence_at).getTime() === occurrence.getTime(),
              ),
          )
          .map(() => toCents(event.amount || 0));
      } catch {
        invalidBills = true;
        return [];
      }
    })
    .reduce((a, b) => a + b, 0);
  const spent = (expenses.data || []).reduce(
    (sum, e) => sum + toCents(e.amount),
    0,
  );
  const filters = {
    search,
    category: filterCategory,
    origin,
    minimum,
    maximum,
  };
  const visibleExpenses = (expenses.data || [])
    .filter((expense) =>
      matchesExpense(
        expense,
        filters,
        categories.data?.find((category) => category.id === expense.category_id)
          ?.name || t('uncategorized'),
      ),
    )
    .sort((a, b) => {
      if (sort === 'amountHigh' || sort === 'amountLow')
        return (
          (toCents(a.amount) - toCents(b.amount)) *
          (sort === 'amountHigh' ? -1 : 1)
        );
      return (
        a.spent_on.localeCompare(b.spent_on) * (sort === 'newest' ? -1 : 1)
      );
    });
  const filteredTotal = visibleExpenses.reduce(
    (sum, expense) => sum + toCents(expense.amount),
    0,
  );
  const filterCount =
    Number(!!search) +
    Number(filterCategory !== 'all') +
    Number(origin !== 'all') +
    Number(!!minimum) +
    Number(!!maximum) +
    Number(sort !== 'newest');
  const total = budgets.data?.find((b) => !b.category_id);
  const limit = total ? toCents(total.monthly_amount) : null;
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: ['expenses', session!.user.id],
    });
    await client.invalidateQueries({ queryKey: ['budgets', session!.user.id] });
  };
  const run = (fn: () => Promise<void>, finish: () => void) => {
    if (!canEdit) return;
    setError(false);
    setPending(true);
    void fn()
      .then(refresh)
      .then(finish)
      .catch(() => setError(true))
      .finally(() => setPending(false));
  };
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('money')}</h1>
          <p>{t('moneySubtitle')}</p>
        </div>
        {canEdit && (
          <Link className="button" to="/add/expense">
            <Icon name="plus" />
            {t('expenseNew')}
          </Link>
        )}
      </header>
      <SectionNavigation section={'money'} />
      <div className="money-period-controls">
        <MoneyPeriodSelector
          month={month}
          view={view}
          currentMonth={currentMonth}
          disabled={pending}
          onChange={changePeriod}
        />
        <div
          className="segmented money-views"
          role="group"
          aria-label={explore.period}
        >
          <Button
            variant="secondary"
            aria-pressed={view === 'month'}
            disabled={pending}
            onClick={() => changePeriod(month, 'month')}
          >
            {moneyCopy.monthView}
          </Button>
          <Button
            variant="secondary"
            aria-pressed={view === 'year'}
            disabled={pending}
            onClick={() => changePeriod(month, 'year')}
          >
            {moneyCopy.yearView}
          </Button>
        </div>
      </div>
      {!canEdit && <Banner>{moneyCopy.readOnly}</Banner>}
      {(expenses.isPending || budgets.isPending) && <Spinner />}
      {(expenses.isError || budgets.isError || categories.isError) && (
        <Banner alert>
          {t('error')}{' '}
          <Button
            variant="secondary"
            onClick={() => {
              void expenses.refetch();
              void budgets.refetch();
              void categories.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </Banner>
      )}
      {error && <Banner alert>{t('actionError')}</Banner>}
      <p className="eyebrow">
        {view === 'year' ? moneyCopy.yearOverview : explore.monthOverview}
      </p>
      <div className="stat-grid money-overview">
        <Card className="stat-card">
          <p>
            <Icon name="wallet" />
            {moneyCopy.spent}
          </p>
          <h2>
            {expenses.isPending || expenses.isError
              ? '…'
              : formatMoney(spent, locale)}
          </h2>
        </Card>
        <Card className="stat-card">
          <p>
            <Icon name="receipt" />
            {canEdit
              ? t('budgetRemaining')
              : view === 'year'
                ? moneyCopy.monthsWithExpenses
                : explore.averageExpense}
          </p>
          <h2>
            {expenses.isPending ||
            expenses.isError ||
            (canEdit && (budgets.isPending || budgets.isError))
              ? '…'
              : !canEdit
                ? view === 'year'
                  ? yearlySpending(
                      expenses.data || [],
                      month.slice(0, 4),
                    ).filter((item) => item.count > 0).length
                  : formatMoney(
                      expenses.data?.length
                        ? Math.round(spent / expenses.data.length)
                        : 0,
                      locale,
                    )
                : limit === null
                  ? t('noBudget')
                  : formatMoney(limit - spent, locale)}
          </h2>
          {canEdit && limit !== null && spent > limit && (
            <p>{t('overBudget')}</p>
          )}
        </Card>
        <Card className="stat-card">
          <p>
            <Icon name="plus" />
            {t('recordedExpenses')}
          </p>
          <h2>
            {expenses.isPending || expenses.isError
              ? '…'
              : expenses.data?.length}
          </h2>
        </Card>
      </div>
      {view === 'month' && (
        <Card>
          <p>{t('unpaidThisMonth')}</p>
          <h2>
            {bills.isPending ||
            paidBills.isPending ||
            bills.isError ||
            paidBills.isError ||
            invalidBills
              ? '…'
              : formatMoney(unpaid, locale)}
          </h2>
          <p>{t('budgetBalanceHelp')}</p>
          <Link className="button secondary" to="/bills">
            {t('bills')}
          </Link>
          {(bills.isError || paidBills.isError) && (
            <Banner alert>
              {t('error')}
              <Button
                onClick={() => {
                  void bills.refetch();
                  void paidBills.refetch();
                }}
              >
                {t('retry')}
              </Button>
            </Banner>
          )}
          {invalidBills && <Banner alert>{t('invalidSchedule')}</Banner>}
        </Card>
      )}
      {canEdit ? (
        <>
          <header className="page-heading">
            <h2>{t('budgets')}</h2>
            <Button
              variant="secondary"
              disabled={
                !online ||
                budgets.isPending ||
                budgets.isError ||
                categories.isPending ||
                categories.isError
              }
              onClick={() => {
                setBudget(null);
                setCategory('');
                setAmount('');
                setError(false);
              }}
            >
              {t('editBudgets')}
            </Button>
          </header>
          <div className="budget-grid">
            {budgets.data?.map((b) => {
              const used = b.category_id
                ? (expenses.data || [])
                    .filter((e) => e.category_id === b.category_id)
                    .reduce((sum, e) => sum + toCents(e.amount), 0)
                : spent;
              const cap = toCents(b.monthly_amount);
              return (
                <Card key={b.id} className="budget-card">
                  <h3>
                    {b.category_id
                      ? categories.data?.find((c) => c.id === b.category_id)
                          ?.name || t('category')
                      : t('overallBudget')}
                  </h3>
                  <p>
                    {formatMoney(used, locale)} / {formatMoney(cap, locale)}
                  </p>
                  <progress
                    max={Math.max(cap, 1)}
                    value={Math.min(used, cap)}
                    aria-label={t('budget')}
                  />
                  {used > cap && <p>{t('overBudget')}</p>}
                  {cap > 0 && (
                    <p>
                      {Math.round((used / cap) * 100)}% {t('budgetUsed')}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    disabled={!online}
                    onClick={() => {
                      setBudget(b);
                      setCategory(b.category_id || '');
                      setAmount(b.monthly_amount.toFixed(2));
                      setError(false);
                    }}
                  >
                    {t('edit')}
                  </Button>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <p>{moneyCopy.budgetHistory}</p>
      )}
      <h2 className="section-heading">{moneyCopy.expenses}</h2>
      {expenses.data?.length === 0 && (
        <EmptyState
          title={moneyCopy.empty}
          help={canEdit ? t('emptyExpensesHelp') : moneyCopy.emptyHelp}
        />
      )}
      <p className="list-window">
        {view === 'year' ? moneyCopy.yearHelp : explore.monthHelp}
      </p>
      <FilterPanel
        onSearchClear={() => setSearch('')}
        quickFilters={
          <QuickFilters
            label={explore.origin}
            value={origin}
            onChange={setOrigin}
            options={[
              ['all', explore.allOrigins],
              ['manual', explore.manual],
              ['bill', explore.fromBill],
            ]}
          />
        }
        extraChips={[
          ...(minimum
            ? [
                {
                  label: `${explore.minAmount}: ${minimum}`,
                  onRemove: () => setMinimum(''),
                },
              ]
            : []),
          ...(maximum
            ? [
                {
                  label: `${explore.maxAmount}: ${maximum}`,
                  onRemove: () => setMaximum(''),
                },
              ]
            : []),
        ]}
        title={explore.listAndCharts}
        count={filterCount}
        onReset={() => {
          setSearch('');
          setFilterCategory('all');
          setOrigin('all');
          setMinimum('');
          setMaximum('');
          setSort('newest');
        }}
        results={expenses.isPending ? undefined : visibleExpenses.length}
      >
        <TextField
          fullWidth
          type="search"
          label={copy.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label={explore.category}
          value={filterCategory}
          onChange={setFilterCategory}
          options={[
            ['all', explore.allCategories],
            ['none', explore.uncategorized],
            ...(categories.data || [])
              .filter((category) => category.kind === 'expense')
              .map((category) => [category.id, category.name] as const),
          ]}
        />
        <TextField
          fullWidth
          label={explore.minAmount}
          value={minimum}
          onChange={(event) => setMinimum(event.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          error={!amountBounds(filters)}
        />
        <TextField
          fullWidth
          label={explore.maxAmount}
          value={maximum}
          onChange={(event) => setMaximum(event.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          error={!amountBounds(filters)}
        />
        <FilterSelect
          label={explore.sort}
          value={sort}
          onChange={setSort}
          options={[
            ['newest', explore.newest],
            ['soonest', explore.soonest],
            ['amountHigh', explore.amountHigh],
            ['amountLow', explore.amountLow],
          ]}
        />
      </FilterPanel>
      {!amountBounds(filters) && (
        <Banner alert>{explore.invalidAmounts}</Banner>
      )}
      {!expenses.isPending && !expenses.isError && (
        <Statistics
          items={[
            {
              label: explore.filteredTotal,
              value: formatMoney(filteredTotal, locale),
              icon: 'wallet',
            },
            {
              label: explore.expenses,
              value: visibleExpenses.length,
              icon: 'receipt',
            },
            {
              label: explore.averageExpense,
              value: formatMoney(
                visibleExpenses.length
                  ? Math.round(filteredTotal / visibleExpenses.length)
                  : 0,
                locale,
              ),
              icon: 'calendar',
            },
          ]}
        />
      )}
      {!!expenses.data?.length && !visibleExpenses.length && (
        <EmptyState title={copy.noMatches} help={copy.noMatchesHelp} />
      )}
      {view === 'year' && !expenses.isPending && !expenses.isError && (
        <YearSpending
          rows={visibleExpenses}
          year={month.slice(0, 4)}
          onMonth={(selected) => changePeriod(selected, 'month')}
        />
      )}
      {visibleExpenses.map((expense) => (
        <Card key={expense.id} className="event-card">
          <div className="event-row">
            <Icon name="wallet" />
            <div>
              <h3>
                {expense.note ||
                  categories.data?.find((c) => c.id === expense.category_id)
                    ?.name ||
                  t('expenses')}
              </h3>
              <p>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeZone: 'Europe/Lisbon',
                }).format(new Date(`${expense.spent_on}T12:00:00Z`))}{' '}
                · {formatMoney(toCents(expense.amount), locale)}
              </p>
            </div>
          </div>
          {expense.completion_id ? (
            <p>{t('expenseLinked')}</p>
          ) : canEdit && expense.spent_on.startsWith(`${currentMonth}-`) ? (
            <div className="actions">
              {!expense.completion_id && (
                <Button
                  variant="secondary"
                  onClick={() => setRepeating(expense)}
                >
                  {t('repeatExpense')}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={!online}
                onClick={() => setEditing(expense)}
              >
                {t('edit')}
              </Button>
              <Button
                variant="secondary"
                disabled={!online}
                onClick={() => {
                  setDeleting(expense);
                  setError(false);
                }}
              >
                {t('delete')}
              </Button>
            </div>
          ) : null}
        </Card>
      ))}
      <details className="spending-details">
        <summary>
          <Icon name="wallet" />
          {copy.spendingDetails}
        </summary>
        {view === 'month' && (
          <MoneyInsights
            month={month}
            filters={filters}
            categories={categories.data || []}
          />
        )}
        <h2 className="section-heading">{t('spendingByCategory')}</h2>
        <Card className="category-breakdown">
          <SpendingChart
            items={Array.from(
              new Set(visibleExpenses.map((e) => e.category_id)),
            ).map((id) => ({
              name:
                categories.data?.find((c) => c.id === id)?.name ||
                t('uncategorized'),
              cents: visibleExpenses
                .filter((e) => e.category_id === id)
                .reduce((sum, e) => sum + toCents(e.amount), 0),
            }))}
          />
          <div className="category-totals">
            {Array.from(new Set(visibleExpenses.map((e) => e.category_id))).map(
              (id) => (
                <div className="event-row" key={id || 'none'}>
                  <strong>
                    {categories.data?.find((c) => c.id === id)?.name ||
                      t('uncategorized')}
                  </strong>
                  <span>
                    {formatMoney(
                      visibleExpenses
                        .filter((e) => e.category_id === id)
                        .reduce((sum, e) => sum + toCents(e.amount), 0),
                      locale,
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
        </Card>
      </details>
      {repeating && (
        <Modal title={t('repeatExpense')} onClose={() => setRepeating(null)}>
          <ExpenseForm
            template={repeating}
            onClose={() => setRepeating(null)}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={t('expenseEdit')} onClose={() => setEditing(null)}>
          <ExpenseForm expense={editing} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {deleting && (
        <Modal
          title={t('deleteExpense')}
          busy={pending}
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <p>{t('deleteItemHelp')}</p>
          {error && <Banner alert>{t('actionError')}</Banner>}
          <Button
            variant="danger"
            disabled={pending || !online}
            onClick={() =>
              run(
                async () => {
                  const { error } = await supabase
                    .from('expenses')
                    .delete()
                    .eq('id', deleting.id)
                    .eq('user_id', session!.user.id)
                    .is('completion_id', null);
                  if (error) throw error;
                },
                () => setDeleting(null),
              )
            }
          >
            {t('delete')}
          </Button>
        </Modal>
      )}
      {budget !== undefined && (
        <Modal
          title={t('editBudgets')}
          busy={pending}
          onClose={() => {
            if (!pending) setBudget(undefined);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let cents: number;
              try {
                cents = parseCents(amount);
              } catch {
                setError(true);
                return;
              }
              run(
                async () => {
                  if (!navigator.onLine) throw new Error('Offline');
                  const row = {
                    user_id: session!.user.id,
                    category_id: category || null,
                    monthly_amount: decimalAmount(cents),
                  };
                  const existing =
                    budget ||
                    budgets.data?.find(
                      (b) => b.category_id === (category || null),
                    );
                  const { error } = existing
                    ? await supabase
                        .from('budgets')
                        .update(row)
                        .eq('id', existing.id)
                        .eq('user_id', session!.user.id)
                    : await supabase.from('budgets').insert(row);
                  if (error) throw error;
                },
                () => setBudget(undefined),
              );
            }}
          >
            <Field label={t('category')}>
              <select
                disabled={!!budget}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">{t('overallBudget')}</option>
                {categories.data
                  ?.filter((c) => c.kind === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t('amount')}>
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            {error && <Banner alert>{t('actionError')}</Banner>}
            <div className="actions">
              <Button type="submit" disabled={pending || !online}>
                {t('save')}
              </Button>
              {budget && (
                <Button
                  variant="secondary"
                  disabled={pending || !online}
                  onClick={() =>
                    run(
                      async () => {
                        const { error } = await supabase
                          .from('budgets')
                          .delete()
                          .eq('id', budget.id)
                          .eq('user_id', session!.user.id);
                        if (error) throw error;
                      },
                      () => setBudget(undefined),
                    )
                  }
                >
                  {t('removeBudget')}
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
