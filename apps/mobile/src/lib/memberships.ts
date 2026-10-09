import { membershipState, todayIn } from '@gymos/shared';
import { useQuery } from '@tanstack/react-query';

import { useActiveGym } from '@/lib/gyms';
import { supabase } from '@/lib/supabase';

// Membership data for the active gym. RLS limits subscriptions and payments
// to the signed-in member's own rows.

export function useMembership() {
  const membership = useActiveGym();
  const memberId = membership?.memberId;
  const query = useQuery({
    queryKey: ['subscriptions', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId!)
        .order('starts_on', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const today = membership ? todayIn(membership.gym.timezone) : null;
  const state = query.data && today ? membershipState(query.data, today) : null;
  return { ...query, state };
}

export function usePlans() {
  const gymId = useActiveGym()?.gym.id;
  return useQuery({
    queryKey: ['plans', gymId],
    enabled: !!gymId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('gym_id', gymId!)
        .eq('is_active', true)
        .order('sort_order')
        .order('price_paise');
      if (error) throw error;
      return data;
    },
  });
}

export function useMyPayments() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['payments', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, receipt_no, amount_paise, method, paid_at, subscriptions(plan_name)')
        .eq('member_id', memberId!)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// UPI claims that need the member's attention: one waiting for the gym, and
// any the gym rejected in the last 14 days.
export function usePaymentClaims() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['payment-claims', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('payments')
        .select('id, status, amount_paise, utr, note, created_at, reviewed_at, plans(name)')
        .eq('member_id', memberId!)
        .eq('method', 'upi')
        .or(`status.eq.created,and(status.eq.failed,reviewed_at.gte.${since})`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return {
        pending: data.find((p) => p.status === 'created') ?? null,
        rejected: data.filter((p) => p.status === 'failed'),
      };
    },
  });
}
