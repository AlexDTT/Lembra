import { Chip } from '@mui/material';
import { ReminderGuide } from './ReminderGuide';
import { needsBackendSetup } from '../../lib/backend';
import { FamilySharing } from '../family/Family';
import { useCopy } from '../../i18n/ux';
import { useState } from 'react';
import { useAuth } from '../../app/auth-context';
import { useI18n, type Locale } from '../../i18n/context';
import { supabase } from '../../lib/supabase';
import { Banner, Button, Card, Field } from '../../components/ui';
import { useOnline } from '../../lib/network';
import { useCategories } from '../events/queries';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Icon } from '../../components/Icon';
import { useIntegrations } from './integrations';
import {
  disablePush,
  enablePush,
  pushEnabled,
  pushSupported,
  PushSetupError,
  type PushErrorCode,
} from '../../lib/push';
import { useQuery } from '@tanstack/react-query';
import { fetchAll } from '../../lib/pagination';
export function Settings() {
  const copy = useCopy();
  const { t, locale, setLocale } = useI18n();
  const { signIn, session } = useAuth();
  const online = useOnline();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [reminderError, setReminderError] = useState<
    PushErrorCode | 'actionError' | null
  >(null);
  const categories = useCategories();
  const client = useQueryClient();
  const integrations = useIntegrations();
  const devicePush = useQuery({
    queryKey: ['device-push', session!.user.id],
    queryFn: pushEnabled,
  });
  async function updateReminders(action: () => Promise<unknown>) {
    setPending(true);
    setError(false);
    setReminderError(null);
    try {
      await action();
      await integrations.refetch();
      await devicePush.refetch();
    } catch (error) {
      setReminderError(
        error instanceof PushSetupError ? error.code : 'actionError',
      );
    } finally {
      setPending(false);
    }
  }
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState<
    'appointment' | 'bill' | 'expense'
  >('expense');
  async function exportData() {
    setPending(true);
    setError(false);
    try {
      if (!online || !session) throw new Error('Offline');
      const optional = async (request: Promise<unknown>) => {
        try {
          return await request;
        } catch (error) {
          if (needsBackendSetup(error)) return [];
          throw error;
        }
      };
      const results = await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from('events')
            .select('*')
            .eq('user_id', session.user.id)
            .order('id')
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from('event_completions')
            .select('*')
            .eq('user_id', session.user.id)
            .order('id')
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from('expenses')
            .select('*')
            .eq('user_id', session.user.id)
            .order('id')
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from('budgets')
            .select('*')
            .eq('user_id', session.user.id)
            .order('id')
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from('categories')
            .select('*')
            .eq('user_id', session.user.id)
            .order('id')
            .range(from, to),
        ),
        optional(
          fetchAll((from, to) =>
            supabase
              .from('dose_snoozes')
              .select('*')
              .eq('user_id', session.user.id)
              .order('event_id')
              .order('occurrence_at')
              .range(from, to),
          ),
        ),
        optional(
          fetchAll((from, to) =>
            supabase
              .from('family_shares')
              .select('*')
              .eq('user_id', session.user.id)
              .order('id')
              .range(from, to),
          ),
        ),
        optional(
          fetchAll((from, to) =>
            supabase
              .from('tasks')
              .select('*')
              .eq('user_id', session.user.id)
              .order('id')
              .range(from, to),
          ),
        ),
        optional(
          fetchAll((from, to) =>
            supabase
              .from('task_completions')
              .select('*')
              .eq('user_id', session.user.id)
              .order('task_id')
              .order('occurrence_on')
              .range(from, to),
          ),
        ),
        fetchAll((from, to) =>
          supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .order('user_id')
            .range(from, to),
        ),
      ]);
      const exported = Object.fromEntries(
        [
          'events',
          'completions',
          'expenses',
          'budgets',
          'categories',
          'snoozes',
          'family_shares',
          'tasks',
          'task_completions',
          'settings',
        ].map((key, i) => [key, results[i]]),
      );
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                version: 1,
                exported_at: new Date().toISOString(),
                ...exported,
              },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        ),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `lembra-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  async function changeLanguage(next: Locale) {
    setLocale(next);
    setError(false);
    if (online && session) {
      const { error } = await supabase
        .from('user_settings')
        .update({ locale: next })
        .eq('user_id', session.user.id);
      if (error) setError(true);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{t('settings')}</h1>
          <p>{copy.settingsHelp}</p>
        </div>
      </header>
      <div className="settings-grid">
        <Card>
          <h2>
            <Icon name="bell" /> {t('reminderSettings')}
          </h2>
          <Chip
            className="integration-chip"
            size="small"
            color={integrations.data?.google_connected ? 'success' : 'warning'}
            label={t(
              integrations.data?.google_connected
                ? 'googleConnected'
                : 'googleDisconnected',
            )}
          />
          {integrations.isError && <Banner alert>{t('error')}</Banner>}
          {integrations.data?.google_error && (
            <Banner alert>{t('syncError')}</Banner>
          )}
          {integrations.data?.google_last_success && (
            <p>
              {t('lastSynced')}:{' '}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'Europe/Lisbon',
              }).format(new Date(integrations.data.google_last_success))}
            </p>
          )}
          <div className="actions">
            <Button
              variant="secondary"
              disabled={pending || !online}
              onClick={() => void updateReminders(signIn)}
            >
              {t('reconnect')}
            </Button>
            <Button
              variant="secondary"
              disabled={
                pending || !online || !integrations.data?.google_connected
              }
              onClick={() =>
                void updateReminders(async () => {
                  const { data, error } = await supabase.functions.invoke(
                    'calendar-sync',
                    { body: {} },
                  );
                  if (error || data?.failed) throw new Error('Sync failed');
                })
              }
            >
              {t(pending ? 'syncing' : 'syncNow')}
            </Button>
          </div>
          <h3 className="section-heading">{t('reminderSettingsHelp')}</h3>
          <p>
            {t(
              !pushSupported()
                ? 'notificationsUnsupported'
                : devicePush.data
                  ? 'notificationsEnabled'
                  : 'notificationsHelp',
            )}
          </p>
          {pushSupported() && (
            <Button
              variant="secondary"
              disabled={
                pending || !online || !import.meta.env.VITE_VAPID_PUBLIC_KEY
              }
              onClick={() =>
                void updateReminders(() =>
                  devicePush.data
                    ? disablePush(session!.user.id)
                    : enablePush(session!.user.id),
                )
              }
            >
              {t(
                devicePush.data
                  ? 'disableNotifications'
                  : 'enableNotifications',
              )}
            </Button>
          )}
          {!import.meta.env.VITE_VAPID_PUBLIC_KEY && pushSupported() && (
            <Banner alert>{t('pushConfiguration')}</Banner>
          )}
          {reminderError && <Banner alert>{t(reminderError)}</Banner>}
          <p>{t('calendarEditHelp')}</p>
          <ReminderGuide />
        </Card>
        <Card>
          <h2>
            <Icon name="settings" />
            {t('preferences')}
          </h2>
          <p>{copy.preferencesHelp}</p>
          <Field label={t('language')}>
            <select
              value={locale}
              onChange={(event) => {
                void changeLanguage(event.target.value as Locale);
              }}
            >
              <option value="pt-PT">{t('portuguese')}</option>
              <option value="en">{t('english')}</option>
            </select>
          </Field>
          <p>{t('timezone')}: Europe/Lisbon</p>
          <p>{t('privacy')}</p>
          {error && <Banner alert>{t('actionError')}</Banner>}
        </Card>
        <Card>
          <h2>
            <Icon name="plus" />
            {t('categories')}
          </h2>
          <p>{copy.categoriesHelp}</p>
          {categories.isError && <Banner alert>{t('error')}</Banner>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = z
                .string()
                .trim()
                .min(1)
                .max(60)
                .safeParse(categoryName);
              if (!parsed.success) {
                setError(true);
                return;
              }
              setPending(true);
              setError(false);
              void Promise.resolve(
                supabase.from('categories').insert({
                  user_id: session!.user.id,
                  kind: categoryKind,
                  name: parsed.data,
                }),
              )
                .then(async ({ error }) => {
                  if (error) {
                    setError(true);
                    return;
                  }
                  setCategoryName('');
                  await client.invalidateQueries({
                    queryKey: ['categories', session!.user.id],
                  });
                })
                .catch(() => setError(true))
                .finally(() => setPending(false));
            }}
          >
            <div className="form-grid">
              <Field label={t('categoryName')}>
                <input
                  required
                  maxLength={60}
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </Field>
              <Field label={t('eventType')}>
                <select
                  value={categoryKind}
                  onChange={(e) =>
                    setCategoryKind(e.target.value as typeof categoryKind)
                  }
                >
                  <option value="appointment">{t('appointments')}</option>
                  <option value="bill">{t('bills')}</option>
                  <option value="expense">{t('expenses')}</option>
                </select>
              </Field>
            </div>
            <Button type="submit" disabled={pending || !online}>
              {t('categoryNew')}
            </Button>
          </form>
        </Card>
        <Card>
          <h2>
            <Icon name="shield" />
            {t('account')}
          </h2>
          <p>{session?.user.email}</p>
          <p>{t('privacyShort')}</p>
          <p>{t('exportHelp')}</p>
          <Button
            variant="secondary"
            disabled={pending || !online}
            onClick={() => void exportData()}
          >
            {t('dataExport')}
          </Button>
        </Card>
        <FamilySharing />
      </div>
    </>
  );
}
