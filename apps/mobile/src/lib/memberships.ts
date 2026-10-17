import { membershipState, receiptView, todayIn } from '@gymos/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

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
        .select('id, receipt_no, amount_paise, method, paid_at, subscriptions(plan_name), pt_subscriptions(package_name)')
        .eq('member_id', memberId!)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// UPI claims that need the member's attention: one waiting for the gym, and
// any the gym rejected in the last 14 days. While one is waiting it's checked
// every few seconds, so "Withdraw" disappears and the membership shows as soon
// as the gym confirms (or rejects) it.
export function usePaymentClaims() {
  const memberId = useActiveGym()?.memberId;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['payment-claims', memberId],
    enabled: !!memberId,
    refetchInterval: (q) => (q.state.data?.pending ? 8_000 : false),
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

  // The waiting claim was just decided: refresh what it changed.
  const waitingId = query.data?.pending?.id ?? null;
  const lastWaiting = useRef(waitingId);
  useEffect(() => {
    if (lastWaiting.current && lastWaiting.current !== waitingId) {
      for (const key of ['subscriptions', 'payments', 'notifications']) void queryClient.invalidateQueries({ queryKey: [key] });
    }
    lastWaiting.current = waitingId;
  }, [waitingId, queryClient]);

  return query;
}

// One paid payment with what it was for, laid out as a receipt.
export function useReceipt(paymentId: string) {
  const membership = useActiveGym();
  return useQuery({
    queryKey: ['receipt', paymentId],
    enabled: !!membership,
    queryFn: async () => {
      const [payment, profile] = await Promise.all([
        supabase
          .from('payments')
          .select('receipt_no, paid_at, amount_paise, method, utr, subscriptions(plan_name, starts_on, ends_on), pt_subscriptions(package_name, starts_on, ends_on, sessions_total)')
          .eq('id', paymentId)
          .eq('status', 'paid')
          .single(),
        supabase.auth.getUser().then(({ data }) => supabase.from('profiles').select('full_name').eq('id', data.user!.id).single()),
      ]);
      if (payment.error) throw payment.error;
      const p = payment.data;
      const pt = p.pt_subscriptions;
      const sub = p.subscriptions;
      return receiptView({
        gym: membership!.gym,
        memberName: profile.data?.full_name ?? '',
        payment: p,
        item: pt
          ? { kind: 'pt', name: pt.package_name, starts_on: pt.starts_on, ends_on: pt.ends_on, sessions: pt.sessions_total }
          : sub
            ? { kind: 'plan', name: sub.plan_name, starts_on: sub.starts_on, ends_on: sub.ends_on }
            : null,
      });
    },
  });
}

// Right after a UPI claim: ask the site to alert whoever confirms payments at
// the gym (a phone notification, apps/web/src/app/api/push/upi-claim). The web
// app shares the site's sign-in cookie; the Android app sends its token to the
// site it links to. Best effort: if it fails, the claim still shows in the
// admin's notifications as before.
export async function alertGymOfClaim(paymentId: string) {
  try {
    if (Platform.OS === 'web') {
      await fetch('/api/push/upi-claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) });
      return;
    }
    const host = process.env.EXPO_PUBLIC_APP_LINK_HOST;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!host || !token) return;
    await fetch(`https://${host}/api/push/upi-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId }),
    });
  } catch {
    // Offline or the site is unreachable: nothing to do.
  }
}
