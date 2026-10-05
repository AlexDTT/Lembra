import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
export function useIntegrations() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['integrations', session!.user.id],
    refetchInterval: 60000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('integration_status')
        .select('*')
        .eq('user_id', session!.user.id)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
