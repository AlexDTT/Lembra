import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../app/auth-context';
import { supabase } from './supabase';
export function needsBackendSetup(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    ['PGRST205', 'PGRST202', '42P01', '42703'].includes(String(error.code))
  );
}
export function useCareBackend() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['care-backend', session!.user.id],
    staleTime: 60000,
    queryFn: async ({ signal }) => {
      const { error } = await supabase
        .from('dose_snoozes')
        .select('event_id')
        .eq('user_id', session!.user.id)
        .limit(0)
        .abortSignal(signal);
      if (needsBackendSetup(error)) return false;
      if (error) throw error;
      return true;
    },
  });
}
