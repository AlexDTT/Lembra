import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
export const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  tokenError: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth provider missing');
  return value;
}
