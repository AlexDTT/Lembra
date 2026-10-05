import { reminderConfirmed } from '../settings/device-check';
import { useI18n } from '../../i18n/context';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useCopy } from '../../i18n/ux';
import { useIntegrations } from '../settings/integrations';
import { pushEnabled } from '../../lib/push';
import { Card } from '../../components/ui';
import { Icon } from '../../components/Icon';

export function ReminderSetup() {
  const copy = useCopy();
  const { t } = useI18n();
  const { session } = useAuth();
  const integrations = useIntegrations();
  const push = useQuery({
    queryKey: ['device-push', session!.user.id],
    queryFn: pushEnabled,
  });
  if (
    integrations.isPending ||
    push.isPending ||
    (integrations.data?.google_connected &&
      !integrations.data.google_error &&
      push.data &&
      reminderConfirmed(session!.user.id))
  )
    return null;
  return (
    <Card className="setup-card">
      <h2>
        <Icon name="bell" />
        {copy.setupTitle}
      </h2>
      <p>{copy.setupHelp}</p>
      {integrations.data?.google_connected && push.data && (
        <p>{t('connectedOnly')}</p>
      )}
      <div className="setup-steps">
        {[
          [copy.googleStep, !!integrations.data?.google_connected],
          [copy.pushStep, !!push.data],
        ].map(([label, ready], index) => (
          <div
            key={String(label)}
            className={`setup-step ${ready ? 'ready' : ''}`}
          >
            <span>{ready ? <Icon name="check" size={16} /> : index + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Link className="button secondary" to="/settings">
        {copy.configure}
        <Icon name="arrow" size={18} />
      </Link>
    </Card>
  );
}
