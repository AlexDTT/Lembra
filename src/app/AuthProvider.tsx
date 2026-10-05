import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContext } from './auth-context';
import { disablePush } from '../lib/push';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [tokenError, setTokenError] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next);
      setLoading(false);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        for (const key of Object.keys(localStorage))
          if (key.startsWith('lembra-data:')) localStorage.removeItem(key);
      }
      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        next?.provider_refresh_token
      ) {
        // Defer Supabase work until the synchronous auth callback releases its lock.
        const token = next.provider_refresh_token;
        const userId = next.user.id;
        setTimeout(() => {
          void supabase.functions
            .invoke('store-google-token', { body: { refresh_token: token } })
            .then(({ error }) => {
              if (mounted) setTokenError(Boolean(error));
              if (error) return;
              // Remove provider secrets from the locally persisted session after secure transfer.
              for (const key of Object.keys(localStorage)) {
                if (!key.startsWith('sb-') || !key.endsWith('-auth-token'))
                  continue;
                try {
                  const stored: unknown = JSON.parse(
                    localStorage.getItem(key) || 'null',
                  );
                  if (
                    stored &&
                    typeof stored === 'object' &&
                    'user' in stored &&
                    stored.user &&
                    typeof stored.user === 'object' &&
                    'id' in stored.user &&
                    stored.user.id === userId
                  ) {
                    const clean = {
                      ...stored,
                      provider_refresh_token: null,
                      provider_token: null,
                    };
                    localStorage.setItem(key, JSON.stringify(clean));
                  }
                } catch {
                  /* Ignore unrelated malformed storage, without logging token values. */
                }
              }
            });
        }, 0);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        setSession(error ? null : data.session);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);
  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  };
  const signOut = async () => {
    if (session) await disablePush(session.user.id).catch(() => {});
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    queryClient.clear();
    for (const key of Object.keys(localStorage))
      if (key.startsWith('lembra-data:')) localStorage.removeItem(key);
    setSession(null);
    setTokenError(false);
  };
  return (
    <AuthContext.Provider
      value={{ session, loading, tokenError, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
