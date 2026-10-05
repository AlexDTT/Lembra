import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Field, Modal } from '../../components/ui';
import { localDate } from '../../lib/dates';
import { decimalAmount, parseCents } from '../../lib/money';
import { useOnline } from '../../lib/network';
import { supabase } from '../../lib/supabase';
import type { EventRow } from '../../types/domain';
export function PayBill({
  event,
  occurrence,
  onClose,
}: {
  event: EventRow;
  occurrence: Date;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const client = useQueryClient();
  const online = useOnline();
  const [amount, setAmount] = useState((event.amount || 0).toFixed(2));
  const [paidOn, setPaidOn] = useState(localDate());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Modal title={event.title} onClose={onClose} busy={pending}>
      <p>{t('payHelp')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(false);
          let cents: number;
          try {
            cents = parseCents(amount);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn))
              throw new Error('Invalid date');
          } catch {
            setError(true);
            return;
          }
          setPending(true);
          void (async () => {
            const { error } = await supabase.rpc('mark_bill_paid', {
              p_event_id: event.id,
              p_occurrence_at: occurrence.toISOString(),
              p_amount_paid: decimalAmount(cents),
              p_paid_on: paidOn,
            });
            if (error) throw error;
            await Promise.all(
              ['bill-completions', 'completions', 'expenses'].map((key) =>
                client.invalidateQueries({ queryKey: [key, session!.user.id] }),
              ),
            );
            onClose();
          })()
            .catch(() => setError(true))
            .finally(() => setPending(false));
        }}
      >
        <Field label={t('amountPaid')}>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t('paidOn')}>
          <input
            required
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </Field>
        {error && (
          <Banner alert>
            {t('generalValidation')} {t('actionError')}
          </Banner>
        )}
        <Button type="submit" disabled={pending || !online}>
          {t(pending ? 'saving' : 'confirm')}
        </Button>
      </form>
    </Modal>
  );
}
