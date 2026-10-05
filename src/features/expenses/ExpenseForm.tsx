import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, Field } from '../../components/ui';
import { useFormPending } from '../../components/modal-context';
import { localDate, localInstant } from '../../lib/dates';
import {
  decimalAmount,
  parseCents,
  formatMoney,
  toCents,
} from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { useOnline } from '../../lib/network';
import { useCategories } from '../events/queries';
import type { Tables } from '../../types/database';
import { useMoneyCopy } from '../../i18n/money';
import { RepeatControl } from '../../components/RepeatControl';
import { validateRepeat, repeatPreview } from '../../lib/repeat';
const schema = z.object({
  amount: z.string(),
  spent_on: z.iso.date(),
  note: z.string().trim().max(500),
  category_id: z.union([z.uuid(), z.literal('')]),
});
export function ExpenseForm({
  expense,
  template,
  onClose,
}: {
  expense?: Tables<'expenses'>;
  template?: Tables<'expenses'>;
  onClose?: () => void;
}) {
  const { t, locale } = useI18n();
  const moneyCopy = useMoneyCopy();
  const currentMonth = localDate().slice(0, 7);
  const nextMonth = new Date(`${currentMonth}-01T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  const { session } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const categories = useCategories();
  const online = useOnline();
  const [rrule, setRrule] = useState<string | null>(null);
  const [repeatTitle, setRepeatTitle] = useState('');
  const [input, setInput] = useState({
    amount: (expense || template)?.amount.toFixed(2) || '',
    spent_on: expense?.spent_on || localDate(),
    note: (expense || template)?.note || '',
    category_id: (expense || template)?.category_id || '',
  });
  const recent = useQuery({
    queryKey: ['expense-shortcuts', session!.user.id],
    enabled: !expense,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', session!.user.id)
        .is('completion_id', null)
        .order('spent_on', { ascending: false })
        .limit(30)
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  const shortcuts = [
    ...new Map(
      (recent.data || []).map((e) => [
        `${e.note || ''}:${e.category_id || ''}:${e.amount}`,
        e,
      ]),
    ).values(),
  ].slice(0, 4);
  const recentCategories = [
    ...new Set((recent.data || []).map((e) => e.category_id).filter(Boolean)),
  ].slice(0, 4);
  const [pending, setPending] = useFormPending();
  const [error, setError] = useState<
    'generalValidation' | 'saveError' | 'currentMonthOnly' | null
  >(null);
  const finish = () => (onClose ? onClose() : navigate('/money'));
  return (
    <Card>
      <form
        className="care-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (
            !input.spent_on.startsWith(`${currentMonth}-`) ||
            (expense && !expense.spent_on.startsWith(`${currentMonth}-`))
          ) {
            setError('currentMonthOnly');
            return;
          }
          const parsed = schema.safeParse(input);
          let cents: number;
          try {
            cents = parseCents(input.amount);
            if (!parsed.success || cents <= 0) throw new Error('Invalid input');
            if (rrule) {
              if (!repeatTitle.trim() || repeatTitle.trim().length > 120)
                throw new Error('Missing recurring expense name');
              validateRepeat(
                rrule,
                localInstant(input.spent_on, '09:00').toISOString(),
              );
            }
          } catch {
            setError('generalValidation');
            return;
          }
          setPending(true);
          void (async () => {
            if (!navigator.onLine) throw new Error('Offline');
            const row = {
              user_id: session!.user.id,
              amount: decimalAmount(cents),
              spent_on: input.spent_on,
              note: input.note || null,
              category_id: input.category_id || null,
            };
            const { error } =
              !expense && rrule
                ? await supabase.rpc('create_recurring_expense', {
                    p_input: {
                      ...row,
                      title: repeatTitle.trim(),
                      rrule,
                      starts_at: repeatPreview({
                        starts_at: localInstant(
                          input.spent_on,
                          '09:00',
                        ).toISOString(),
                        rrule,
                        timezone: 'Europe/Lisbon',
                      })[0].toISOString(),
                    },
                  })
                : expense
                  ? await supabase
                      .from('expenses')
                      .update(row)
                      .eq('id', expense.id)
                      .eq('user_id', session!.user.id)
                      .is('completion_id', null)
                  : await supabase.from('expenses').insert(row);
            if (error) throw error;
            if (rrule)
              await client.invalidateQueries({
                queryKey: ['events', session!.user.id],
              });
            await client.invalidateQueries({
              queryKey: ['expenses', session!.user.id],
            });
            await client.invalidateQueries({
              queryKey: ['expense-shortcuts', session!.user.id],
            });
          })()
            .then(finish)
            .catch(() => setError('saveError'))
            .finally(() => setPending(false));
        }}
      >
        <p>{moneyCopy.currentMonthOnly}</p>
        {!expense && (
          <details className="form-details">
            <summary>{t('recentShortcuts')}</summary>
            <p>{t('shortcutHelp')}</p>
            {recent.isPending && <p>{t('loading')}</p>}
            {recent.isError && (
              <Banner alert>
                {t('error')}
                <Button onClick={() => void recent.refetch()}>
                  {t('retry')}
                </Button>
              </Banner>
            )}
            <div className="actions">
              {shortcuts.map((e) => (
                <Button
                  variant="secondary"
                  key={e.id}
                  onClick={() =>
                    setInput({
                      ...input,
                      amount: e.amount.toFixed(2),
                      category_id: e.category_id || '',
                      note: e.note || '',
                    })
                  }
                >
                  {e.note ||
                    categories.data?.find((c) => c.id === e.category_id)
                      ?.name ||
                    t('expenseNew')}{' '}
                  · {formatMoney(toCents(e.amount), locale)}
                </Button>
              ))}
            </div>
            <p>{t('frequentCategories')}</p>
            <div className="actions">
              {recentCategories.map((id) => (
                <Button
                  key={id}
                  variant="secondary"
                  onClick={() => setInput({ ...input, category_id: id || '' })}
                >
                  {categories.data?.find((c) => c.id === id)?.name ||
                    t('uncategorized')}
                </Button>
              ))}
            </div>
          </details>
        )}
        <div className="form-grid">
          <Field label={t('amount')}>
            <input
              required
              inputMode="decimal"
              value={input.amount}
              onChange={(e) => setInput({ ...input, amount: e.target.value })}
            />
          </Field>
          <Field label={t('date')}>
            <input
              required
              type="date"
              min={`${currentMonth}-01`}
              max={nextMonth.toISOString().slice(0, 10)}
              value={input.spent_on}
              onChange={(e) => setInput({ ...input, spent_on: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t('category')}>
          <select
            value={input.category_id}
            onChange={(e) =>
              setInput({ ...input, category_id: e.target.value })
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
        {categories.isError && <Banner alert>{t('error')}</Banner>}
        <Field label={t('expenseNote')}>
          <input
            maxLength={500}
            placeholder={t('expenseNotePlaceholder')}
            value={input.note}
            onChange={(e) => setInput({ ...input, note: e.target.value })}
          />
        </Field>
        {!expense && (
          <>
            <RepeatControl
              value={rrule}
              day={input.spent_on}
              onChange={setRrule}
            />
            {rrule && (
              <>
                <Field label={t('repeatExpenseTitle')}>
                  <input
                    required
                    maxLength={120}
                    value={repeatTitle}
                    onChange={(e) => setRepeatTitle(e.target.value)}
                  />
                </Field>
                <p className="form-hint">{t('repeatExpenseHelp')}</p>
              </>
            )}
          </>
        )}
        {error && (
          <Banner alert>
            {error === 'currentMonthOnly'
              ? moneyCopy.currentMonthOnly
              : t(error)}
          </Banner>
        )}
        <div className="actions">
          <Button type="submit" disabled={pending || !online}>
            {t(pending ? 'saving' : 'save')}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={finish}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
export function AddExpense() {
  const { t } = useI18n();
  return (
    <div className="form-page">
      <header className="page-heading">
        <h1>{t('expenseNew')}</h1>
      </header>
      <ExpenseForm />
    </div>
  );
}
