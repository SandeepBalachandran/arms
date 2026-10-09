import { ptState, todayIn } from '@gymos/shared';
import { useQuery } from '@tanstack/react-query';

import { useActiveGym } from '@/lib/gyms';
import { supabase } from '@/lib/supabase';

type SessionRow = { session_on: string; notes: string | null };

// The member's own PT packages (with trainer name and sessions done).
export function useMyPt() {
  const gym = useActiveGym()?.gym;
  return useQuery({
    queryKey: ['my-pt', gym?.id],
    enabled: !!gym?.pt_enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_pt_subscriptions', { p_gym_id: gym!.id });
      if (error) throw error;
      const today = todayIn(gym!.timezone);
      return data.map((s) => {
        const sessions = s.sessions as SessionRow[];
        return { ...s, sessions, state: ptState(s, sessions.length, today) };
      });
    },
  });
}

// Packages members can buy, when the gym shows PT in the app.
export function usePtPackages() {
  const gym = useActiveGym()?.gym;
  return useQuery({
    queryKey: ['pt-packages', gym?.id],
    enabled: !!gym?.pt_enabled && gym.pt_show_in_app,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pt_packages')
        .select('*')
        .eq('gym_id', gym!.id)
        .eq('is_active', true)
        .order('sort_order')
        .order('price_paise');
      if (error) throw error;
      return data;
    },
  });
}
