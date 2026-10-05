import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { useI18n } from '../../i18n/context';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';

export function MedicationPhoto({ path }: { path?: string | null }) {
  const { session } = useAuth();
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ['photo', session!.user.id, path],
    enabled: !!path,
    staleTime: 40 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('medication-photos')
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return query.data ? (
    <img
      className="medicine-photo"
      src={query.data}
      alt={t('photoAlt')}
      onError={(e) => {
        e.currentTarget.hidden = true;
      }}
    />
  ) : (
    <div className="medicine-placeholder">
      <Icon name="pill" size={38} />
    </div>
  );
}
