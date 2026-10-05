import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
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
import { supabase } from '../../lib/supabase';
import { needsBackendSetup } from '../../lib/backend';
import { useOnline } from '../../lib/network';
import { dayBounds, localDate, localTime } from '../../lib/dates';
import { shiftDay } from '../../lib/filters';
import { occurrencesBetween } from '../../lib/recurrence';
import { formatMoney, toCents } from '../../lib/money';
import type { Tables } from '../../types/database';
const familySchema = z.array(
  z.object({
    id: z.uuid(),
    owner: z.string(),
    medications: z.boolean(),
    appointments: z.boolean(),
    bills: z.boolean(),
    events: z.array(
      z.object({
        id: z.uuid(),
        type: z.enum(['medication', 'appointment', 'bill']),
        title: z.string(),
        dose: z.string().nullable(),
        starts_at: z.string(),
        ends_at: z.string().nullable(),
        timezone: z.string(),
        rrule: z.string().nullable(),
        active: z.boolean(),
        all_day: z.boolean(),
        excluded_dates: z.array(z.string()),
        amount: z.number().nullable(),
      }),
    ),
    completions: z.array(
      z.object({
        event_id: z.uuid(),
        occurrence_at: z.string(),
        status: z.enum(['done', 'skipped']),
      }),
    ),
  }),
);
export function FamilySharing() {
  const { t } = useI18n();
  const { session } = useAuth();
  const client = useQueryClient();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [scopes, setScopes] = useState({
    medications: false,
    appointments: false,
    bills: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [revoking, setRevoking] = useState<Tables<'family_shares'> | null>(
    null,
  );
  const key = ['family-shares', session!.user.id];
  const shares = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('family_shares')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at')
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  return (
    <Card>
      <h2>{t('familySharing')}</h2>
      <p>{t('familyHelp')}</p>
      <p>{t('familyAllowlist')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(false);
          const parsed = z.email().max(254).safeParse(email.trim());
          if (!parsed.success || !Object.values(scopes).some(Boolean)) {
            setError(true);
            return;
          }
          setPending(true);
          void (async () => {
            const { error } = await supabase.rpc('share_with_family', {
              p_email: parsed.data.toLowerCase(),
              p_medications: scopes.medications,
              p_appointments: scopes.appointments,
              p_bills: scopes.bills,
            });
            if (error) throw error;
            await client.invalidateQueries({ queryKey: key });
            setEmail('');
            setScopes({
              medications: false,
              appointments: false,
              bills: false,
            });
          })()
            .catch(() => setError(true))
            .finally(() => setPending(false));
        }}
      >
        <Field label={t('familyEmail')}>
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <fieldset>
          <legend>{t('familySharing')}</legend>
          {(['medications', 'appointments', 'bills'] as const).map((scope) => (
            <label className="checkbox" key={scope}>
              <input
                type="checkbox"
                checked={scopes[scope]}
                onChange={(e) =>
                  setScopes({ ...scopes, [scope]: e.target.checked })
                }
              />
              {t(scope)}
            </label>
          ))}
        </fieldset>
        <Button
          type="submit"
          disabled={pending || !online || shares.isPending || !!shares.error}
        >
          {t(pending ? 'saving' : 'share')}
        </Button>
      </form>
      {shares.isPending && <Spinner />}
      {shares.isError && (
        <Banner alert>
          {t(needsBackendSetup(shares.error) ? 'featureSetup' : 'error')}
          <Button onClick={() => void shares.refetch()}>{t('retry')}</Button>
        </Banner>
      )}
      {error && <Banner alert>{t('sharingFailed')}</Banner>}
      {shares.data?.length === 0 && <p>{t('noShares')}</p>}
      {shares.data?.map((share) => (
        <div className="share-row" key={share.id}>
          <p>
            <strong>{share.email}</strong>
            <br />
            {(['medications', 'appointments', 'bills'] as const)
              .filter((s) => share[s])
              .map((s) => t(s))
              .join(' · ')}
          </p>
          <Button
            variant="secondary"
            disabled={pending || !online}
            onClick={() => setRevoking(share)}
          >
            {t('revoke')}
          </Button>
        </div>
      ))}
      {revoking && (
        <Modal
          title={t('revoke')}
          onClose={() => setRevoking(null)}
          busy={pending}
        >
          <p>{revoking.email}</p>
          <p>{t('revokeHelp')}</p>
          <Button
            variant="danger"
            disabled={pending || !online}
            onClick={() => {
              setPending(true);
              setError(false);
              void (async () => {
                const { error } = await supabase
                  .from('family_shares')
                  .delete()
                  .eq('id', revoking.id)
                  .eq('user_id', session!.user.id);
                if (error) throw error;
                await client.invalidateQueries({ queryKey: key });
                setRevoking(null);
              })()
                .catch(() => setError(true))
                .finally(() => setPending(false));
            }}
          >
            {t('revoke')}
          </Button>
          {error && <Banner alert>{t('actionError')}</Banner>}
        </Modal>
      )}
    </Card>
  );
}
export function FamilyView() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['family-view', session!.user.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('read_family_view');
      if (error) throw error;
      return familySchema.parse(data);
    },
  });
  const [from] = dayBounds(localDate());
  const [, to] = dayBounds(shiftDay(localDate(), 6));
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('familyView')}</h1>
          <p>{t('familyReadOnly')}</p>
        </div>
      </header>
      {query.isPending && <Spinner />}
      {query.isError && (
        <Banner alert>
          {t(needsBackendSetup(query.error) ? 'featureSetup' : 'error')}
          <Button onClick={() => void query.refetch()}>{t('retry')}</Button>
        </Banner>
      )}
      {query.data?.length === 0 && (
        <EmptyState title={t('noFamilyData')} help="" />
      )}
      {query.data?.map((share) => (
        <section key={share.id}>
          <h2>
            {t('sharedBy')}: {share.owner}
          </h2>
          <p>{t('nextSevenDays')}</p>
          {share.events
            .flatMap((event) =>
              occurrencesBetween(event, from, to).map((occurrence) => ({
                event,
                occurrence,
              })),
            )
            .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
            .map(({ event, occurrence }) => {
              const completion = share.completions.find(
                (c) =>
                  c.event_id === event.id &&
                  new Date(c.occurrence_at).getTime() === occurrence.getTime(),
              );
              return (
                <Card key={`${event.id}:${occurrence.toISOString()}`}>
                  <h3>{event.title}</h3>
                  <p>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: event.timezone,
                    }).format(occurrence)}{' '}
                    · {localTime(occurrence, event.timezone)}
                  </p>
                  {event.dose && <p>{event.dose}</p>}
                  {event.type === 'bill' && (
                    <p>{formatMoney(toCents(event.amount || 0), locale)}</p>
                  )}
                  <span className="pill">
                    {completion
                      ? t(
                          event.type === 'bill'
                            ? 'paid'
                            : completion.status === 'done'
                              ? 'done'
                              : 'skipped',
                        )
                      : t('notRecorded')}
                  </span>
                </Card>
              );
            })}
        </section>
      ))}
    </>
  );
}
