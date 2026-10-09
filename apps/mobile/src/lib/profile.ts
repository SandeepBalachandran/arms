import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

export function useProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
