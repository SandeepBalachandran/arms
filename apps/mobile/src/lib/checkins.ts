import { asCheckinResult, CHECKIN_TOKEN_REFRESH_MS, todayIn } from '@gymos/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveGym } from '@/lib/gyms';
import { supabase } from '@/lib/supabase';

// The member's visits over the last two months (for "today" and "this month").
export function useMyVisits() {
  const membership = useActiveGym();
  const memberId = membership?.memberId;
  const query = useQuery({
    queryKey: ['visits', memberId],
    enabled: !!memberId && !!membership?.gym.checkin_enabled,
    queryFn: async () => {
      const since = new Date(Date.now() - 62 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('checkins')
        .select('id, checked_in_at')
        .eq('member_id', memberId!)
        .gte('checked_in_at', since)
        .order('checked_in_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const tz = membership?.gym.timezone ?? 'Asia/Kolkata';
  const today = todayIn(tz);
  const days = (query.data ?? []).map((v) => ({ ...v, day: todayIn(tz, new Date(v.checked_in_at)) }));
  return {
    ...query,
    todayVisit: days.find((v) => v.day === today) ?? null,
    thisMonth: new Set(days.filter((v) => v.day.startsWith(today.slice(0, 7))).map((v) => v.day)).size,
  };
}

export function useSelfCheckIn() {
  const gymId = useActiveGym()?.gym.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('self_check_in', { p_gym_id: gymId! });
      if (error) throw error;
      return asCheckinResult(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] }),
  });
}

// Signed QR token, refreshed while the QR screen is open.
export function useCheckinToken() {
  const gymId = useActiveGym()?.gym.id;
  return useQuery({
    queryKey: ['checkin-token', gymId],
    enabled: !!gymId,
    refetchInterval: CHECKIN_TOKEN_REFRESH_MS,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('issue_checkin_token', { p_gym_id: gymId! });
      if (error) throw error;
      return data;
    },
  });
}
