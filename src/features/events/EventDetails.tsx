import { useState } from 'react';
import {
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, Spinner } from '../../components/ui';
import { localDate, localTime } from '../../lib/dates';
import { formatMoney, toCents } from '../../lib/money';
import { occurrencesBetween } from '../../lib/recurrence';
import { useEvents, useBillCompletions, useEventActions } from './queries';
import { useCompletions, useCompletionAction } from '../today/queries';
import { useOnline } from '../../lib/network';
import { PayBill } from './PayBill';
import { EventForm } from './EventForm';
import { useMedications } from '../medications/queries';
import { groupMedications } from '../medications/model';
import { MedicationForm } from '../medications/MedicationForm';
import { MedicationPhoto } from '../medications/Photo';
import { useDoseSnooze } from '../today/snoozes';
import { Modal } from '../../components/ui';
export function EventDetails() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t, locale } = useI18n();
  const query = useEvents();
  const actions = useEventActions();
  const navigate = useNavigate();
  const [skipPending, setSkipPending] = useState(false);
  const [skipError, setSkipError] = useState(false);
  const medications = useMedications();
  const snooze = useDoseSnooze();
  const event = query.data?.find((e) => e.id === id);
  const completions = useBillCompletions(event?.type === 'bill');
  const [clock] = useState(() => Date.now());
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const requested = new Date(params.get('at') || event?.starts_at || '');
  const recordDay = Number.isFinite(requested.getTime())
    ? localDate(requested, event?.timezone)
    : localDate();
  const doseCompletions = useCompletions(recordDay);
  const doseAction = useCompletionAction(recordDay);
  const online = useOnline();
  let valid = false;
  try {
    valid =
      !!event &&
      Number.isFinite(requested.getTime()) &&
      occurrencesBetween(event, requested, requested).length === 1;
  } catch {
    valid = false;
  }
  if (query.isPending) return <Spinner />;
  if (query.isError)
    return (
      <Banner alert>
        {t('error')}{' '}
        <Button onClick={() => void query.refetch()}>{t('retry')}</Button>
      </Banner>
    );
  if (!event || !valid) return <Banner>{t('itemUnavailable')}</Banner>;
  const occurrence = requested;
  const group = groupMedications(medications.data || []).find((g) =>
    g.rows.some((e) => e.id === event.id),
  );
  const doseCompletion = doseCompletions.data?.find(
    (c) =>
      c.event_id === event.id &&
      new Date(c.occurrence_at).getTime() === occurrence.getTime(),
  );
  const paid = completions.data?.some(
    (c) =>
      c.event_id === event.id &&
      new Date(c.occurrence_at).getTime() === occurrence.getTime(),
  );
  const duration =
    event.type === 'appointment' && event.ends_at
      ? Math.round(
          (new Date(event.ends_at).getTime() -
            new Date(event.starts_at).getTime()) /
            60000,
        )
      : null;
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{event.title}</h1>
          <p>{t('detailsTitle')}</p>
        </div>
      </header>
      <Card>
        <p>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'full',
            timeZone: event.timezone,
          }).format(occurrence)}{' '}
          · {localTime(occurrence, event.timezone)}
          {duration
            ? ` – ${localTime(new Date(occurrence.getTime() + duration * 60000), event.timezone)}`
            : ''}
        </p>
        {event.photo_path && <MedicationPhoto path={event.photo_path} />}
        {event.dose && <p>{event.dose}</p>}
        {event.refill_on && (
          <p>
            {t('refillDate')}: {event.refill_on}
          </p>
        )}
        {event.location && (
          <>
            <p>{event.location}</p>
            <a
              className="button secondary"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('directions')}
            </a>
          </>
        )}
        {event.notes && (
          <>
            <h2>{t('preparation')}</h2>
            <p className="preserve-lines">{event.notes}</p>
          </>
        )}
        {event.type === 'bill' && (
          <>
            <p>{formatMoney(toCents(event.amount || 0), locale)}</p>
            {completions.isError && <Banner alert>{t('error')}</Banner>}
            <Button
              disabled={!!paid || completions.isPending || completions.isError}
              onClick={() => setPaying(true)}
            >
              {t(paid ? 'paid' : 'markPaid')}
            </Button>
          </>
        )}
        {event.type === 'medication' ? (
          <>
            <p>
              {t(
                doseCompletion
                  ? doseCompletion.status === 'done'
                    ? 'done'
                    : 'skipped'
                  : 'notRecorded',
              )}
            </p>
            {doseCompletions.isError && (
              <Banner alert>
                {t('error')}
                <Button onClick={() => void doseCompletions.refetch()}>
                  {t('retry')}
                </Button>
              </Banner>
            )}
            {(doseAction.isError || snooze.isError) && (
              <Banner alert>{t('actionError')}</Banner>
            )}
            {snooze.data && (
              <p role="status">
                {t('snoozed')} {localTime(snooze.data, event.timezone)}
              </p>
            )}
            <div className="actions">
              {(doseCompletion ? [null] : (['done', 'skipped'] as const)).map(
                (status) => (
                  <Button
                    key={status || 'undo'}
                    variant={status === 'done' ? 'primary' : 'secondary'}
                    disabled={
                      !online ||
                      doseAction.isPending ||
                      doseCompletions.isPending ||
                      doseCompletions.isError
                    }
                    onClick={() =>
                      doseAction.mutate({
                        eventId: event.id,
                        occurrence: occurrence.toISOString(),
                        status: status as 'done' | 'skipped' | null,
                      })
                    }
                  >
                    {t(
                      status === null
                        ? 'undo'
                        : status === 'done'
                          ? 'taken'
                          : 'skip',
                    )}
                  </Button>
                ),
              )}
              {!doseCompletion &&
                occurrence.getTime() <= clock &&
                clock - occurrence.getTime() < 23 * 3600000 && (
                  <Button
                    variant="secondary"
                    disabled={
                      !online ||
                      doseAction.isPending ||
                      snooze.isPending ||
                      !snooze.available ||
                      doseCompletions.isPending ||
                      doseCompletions.isError
                    }
                    onClick={() =>
                      snooze.mutate({
                        eventId: event.id,
                        occurrence: occurrence.toISOString(),
                      })
                    }
                  >
                    {t('snooze')}
                  </Button>
                )}
              <Button
                variant="secondary"
                disabled={!group}
                onClick={() => setEditing(true)}
              >
                {t('edit')}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t('edit')}
          </Button>
        )}
        {event.rrule && event.type !== 'medication' && !paid && (
          <Button
            variant="secondary"
            disabled={!online || skipPending}
            onClick={() => {
              setSkipPending(true);
              setSkipError(false);
              void actions
                .skip(event, occurrence)
                .then(() =>
                  navigate(event.type === 'bill' ? '/bills' : '/appointments'),
                )
                .catch(() => setSkipError(true))
                .finally(() => setSkipPending(false));
            }}
          >
            {t('repeatSkip')}
          </Button>
        )}
        {skipError && <Banner alert>{t('actionError')}</Banner>}
        <Link
          className="button secondary"
          to={
            event.type === 'bill'
              ? '/bills'
              : event.type === 'appointment'
                ? '/appointments'
                : '/medications'
          }
        >
          {t('seeAll')}
        </Link>
      </Card>
      {paying && (
        <PayBill
          event={event}
          occurrence={occurrence}
          onClose={() => setPaying(false)}
        />
      )}
      {editing && event.type === 'medication' && group && (
        <Modal title={t('editMedication')} onClose={() => setEditing(false)}>
          <MedicationForm group={group} onClose={() => setEditing(false)} />
        </Modal>
      )}
      {editing && event.type !== 'medication' && (
        <Modal title={t('edit')} onClose={() => setEditing(false)}>
          <EventForm
            type={event.type === 'bill' ? 'bill' : 'appointment'}
            event={event}
            occurrence={occurrence}
            onClose={() => setEditing(false)}
          />
        </Modal>
      )}
      <p>{localDate(occurrence, event.timezone)}</p>
    </>
  );
}
