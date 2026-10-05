import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Chip } from '@mui/material';
import { useAuth } from './auth-context';
import { useI18n } from '../i18n/context';
import { useCopy } from '../i18n/ux';
import { isSupabaseConfigured } from '../lib/supabase';
import { Brand } from '../components/Brand';
import { Banner, Button, Card, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';
import { Landing } from './Landing';

export function Login() {
  const { t } = useI18n();
  const copy = useCopy();
  const { session, loading, signIn } = useAuth();
  const { search, hash } = useLocation();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const params = new URLSearchParams(search || hash.slice(1));
  const rejected = /closed|not.allowed|database.error.saving.new.user/i.test(
    params.get('error_description') || '',
  );
  if (session) return <Navigate to="/" replace />;
  return (
    <main className="login-page">
      <Link className="login-back" to="/">
        <Icon name="arrow" />
        {copy.backHome}
      </Link>
      <Card className="auth-card">
        <Brand />
        <Chip
          icon={<Icon name="shield" size={18} />}
          label={copy.secure}
          className="login-chip"
        />
        <h1>{t(rejected ? 'notAllowed' : 'welcome')}</h1>
        <p>{rejected ? t('notAllowedHelp') : copy.loginHelp}</p>
        {!isSupabaseConfigured ? (
          <Banner>{t('setupHelp')}</Banner>
        ) : loading ? (
          <Spinner />
        ) : (
          <>
            {(failed || (params.has('error') && !rejected)) && (
              <Banner alert>{t('authError')}</Banner>
            )}
            <Button
              disabled={pending}
              onClick={() => {
                setPending(true);
                setFailed(false);
                void signIn().catch(() => {
                  setFailed(true);
                  setPending(false);
                });
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.7 2.9-4.2 2.9-7.4ZM12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3v2.6A10 10 0 0 0 12 22ZM6.4 14a6 6 0 0 1 0-4V7.4H3a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9 5.4L6.4 10A6 6 0 0 1 12 6Z"
                />
              </svg>
              {t(pending ? 'loading' : 'signIn')}
            </Button>
          </>
        )}
        <p className="login-note">{copy.invitation}</p>
      </Card>
      <p className="login-tagline">{copy.tagline}</p>
    </main>
  );
}
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading)
    return (
      <main className="auth-card">
        <Spinner />
      </main>
    );
  if (!session && pathname === '/') return <Landing />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
