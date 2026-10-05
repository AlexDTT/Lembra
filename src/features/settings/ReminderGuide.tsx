import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Banner, Button } from '../../components/ui';
import { pushEnabled, pushSupported } from '../../lib/push';
import { supabase } from '../../lib/supabase';
import { useOnline } from '../../lib/network';
import { deviceCheckKey, reminderConfirmed } from './device-check';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function ReminderGuide() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const online = useOnline();
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(() =>
    reminderConfirmed(session!.user.id),
  );
  const device = useQuery({
    queryKey: ['device-push', session!.user.id],
    queryFn: pushEnabled,
  });
  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', listener);
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  return (
    <section className="reminder-guide">
      <h3>{t('setupGuide')}</h3>
      <ol>
        <li>
          <strong>{t(installed ? 'installed' : 'installApp')}</strong>
          {!installed && (
            <>
              <p>{t('installHelp')}</p>
              {install && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void install
                      .prompt()
                      .then(() => install.userChoice)
                      .then(() => setInstall(null))
                  }
                >
                  {t('installApp')}
                </Button>
              )}
            </>
          )}
        </li>
        <li>
          <strong>{t('phoneChecks')}</strong>
          <p>{t('phoneChecksHelp')}</p>
          <p>{t('googleCheck')}</p>
        </li>
        <li>
          <strong>{t(confirmed ? 'testConfirmed' : 'connectedOnly')}</strong>
          <div className="actions">
            <Button
              disabled={pending || !online || !device.data || !pushSupported()}
              onClick={() => {
                setPending(true);
                setFailed(false);
                setSent(false);
                void (async () => {
                  const registration =
                    await navigator.serviceWorker.getRegistration();
                  const subscription =
                    await registration?.pushManager.getSubscription();
                  if (!subscription) throw new Error('No device');
                  const { data, error } = await supabase.functions.invoke(
                    'test-reminder',
                    { body: { endpoint: subscription.endpoint, locale } },
                  );
                  if (error || !data?.sent) throw new Error('Test failed');
                  setSent(true);
                })()
                  .catch(() => setFailed(true))
                  .finally(() => setPending(false));
              }}
            >
              {t('testReminder')}
            </Button>
            {sent && (
              <Button
                onClick={() => {
                  try {
                    localStorage.setItem(
                      deviceCheckKey(session!.user.id),
                      new Date().toISOString(),
                    );
                    setConfirmed(true);
                  } catch {
                    setFailed(true);
                  }
                }}
              >
                {t('confirmTest')}
              </Button>
            )}
          </div>
          {sent && !confirmed && <Banner>{t('testSent')}</Banner>}
          {failed && <Banner alert>{t('testFailed')}</Banner>}
        </li>
      </ol>
    </section>
  );
}
