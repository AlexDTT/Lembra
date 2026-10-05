import { useState } from 'react';
import { PayBill } from '../events/PayBill';
import type { EventRow } from '../../types/domain';
import { Link } from 'react-router-dom';
import { Chip } from '@mui/material';
import { useCopy } from '../../i18n/ux';
import { useI18n } from '../../i18n/context';
import { Card, Banner, Button } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { localDate } from '../../lib/dates';
import { formatMoney, toCents } from '../../lib/money';
import { useAttentionBills } from './bills';

export function BillAttention({ day }: { day: string }) {
  const copy = useCopy();
  const [paying, setPaying] = useState<{
    event: EventRow;
    occurrence: Date;
  } | null>(null);
  const { t, locale } = useI18n();
  const attention = useAttentionBills(day);
  const { bills, invalid } = attention;
  const today = day;
  if (attention.pending) return null;
  if (attention.error)
    return (
      <Banner alert>
        {t('error')}{' '}
        <Button onClick={() => void attention.refetch()}>{t('retry')}</Button>
      </Banner>
    );
  if (!bills.length && !invalid) return null;
  return (
    <section className="bill-attention">
      {paying && (
        <PayBill
          event={paying.event}
          occurrence={paying.occurrence}
          onClose={() => setPaying(null)}
        />
      )}
      <h2 className="section-heading">
        <Icon name="receipt" />
        {copy.attention}
        <span className="section-count">{bills.length}</span>
      </h2>
      <p>{copy.attentionHelp}</p>
      {invalid && <Banner alert>{t('invalidSchedule')}</Banner>}
      {bills.slice(0, 4).map(({ event, occurrence }) => (
        <Card
          key={`${event.id}:${occurrence.toISOString()}`}
          className="attention-card"
        >
          <div>
            <h3>{event.title}</h3>
            <p>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeZone: event.timezone,
              }).format(occurrence)}{' '}
              ·{' '}
              <strong>{formatMoney(toCents(event.amount || 0), locale)}</strong>
            </p>
          </div>
          <Chip
            size="small"
            color={localDate(occurrence) < today ? 'warning' : 'default'}
            label={
              localDate(occurrence) < today
                ? t('overdue')
                : localDate(occurrence) === today
                  ? t('dueToday')
                  : copy.dueSoon
            }
          />
          <div className="attention-actions actions">
            <Button onClick={() => setPaying({ event, occurrence })}>
              {t('markPaid')}
            </Button>
            <Link
              className="button secondary"
              to={`/items/${event.id}?at=${encodeURIComponent(occurrence.toISOString())}`}
            >
              {copy.viewBill}
            </Link>
          </div>
        </Card>
      ))}
      {bills.length > 4 && (
        <Link className="insight-link" to="/bills">
          {t('seeAll')} ({bills.length})<Icon name="arrow" />
        </Link>
      )}
    </section>
  );
}
