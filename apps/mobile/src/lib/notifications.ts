import { describeNotification, formatDate, formatMoney, formatTime, relativeDay, todayIn, type NotificationLink, type NotificationView } from '@gymos/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSchedule } from '@/lib/classes';
import { useActiveGym } from '@/lib/gyms';
import { useMembership, usePaymentClaims } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

// The member's notifications in the active gym: what happened (stored by the
// database) and reminders worked out from today's date.

export type NotificationItem = NotificationView & { id: string; createdAt: string; unread: boolean };

export function useNotifications() {
  const membership = useActiveGym();
  const memberId = membership?.memberId;
  return useQuery({
    queryKey: ['notifications', memberId],
    enabled: !!memberId,
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, data, created_at, read_at')
        .eq('member_id', memberId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const gym = membership!.gym;
      return data.map((n) => ({
        ...describeNotification(n.kind, (n.data ?? {}) as Record<string, unknown>, gym),
        id: n.id,
        createdAt: n.created_at,
        unread: !n.read_at,
      }));
    },
  });
}

export function useMarkNotificationsRead() {
  const memberId = useActiveGym()?.memberId;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('member_id', memberId!)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', memberId] }),
  });
}

export type Reminder = NotificationView & { key: string };

// Things that need attention now: the membership ending or ended, a UPI
// payment waiting for the gym, a booked class in the next 24 hours.
export function useReminders(): Reminder[] {
  const membership = useActiveGym();
  const { state } = useMembership();
  const claims = usePaymentClaims();
  const schedule = useSchedule();
  // "The next 24 hours" from when the screen opened.
  const [now] = useState(() => Date.now());
  if (!membership) return [];
  const { gym, role } = membership;
  const today = todayIn(gym.timezone);
  const reminders: Reminder[] = [];
  const membershipLink: NotificationLink = '/membership';

  if (role === 'member' && state) {
    if (state.kind === 'expired') {
      reminders.push({ key: 'expired', title: 'Your membership has ended', body: `It ended on ${formatDate(state.last.ends_on)}. Renew to keep checking in.`, link: membershipLink, tone: 'bad' });
    } else if (state.kind === 'active' && !state.next && state.daysLeft <= gym.expiry_warning_days) {
      const when = state.daysLeft === 0 ? 'today' : state.daysLeft === 1 ? 'tomorrow' : `in ${state.daysLeft} days`;
      reminders.push({ key: 'expiring', title: `Your membership ends ${when}`, body: `${state.current.plan_name} · ends ${formatDate(state.current.ends_on)}`, link: membershipLink, tone: 'bad' });
    } else if (state.kind === 'none') {
      reminders.push({ key: 'none', title: 'Choose a membership plan', body: 'Pick a plan to start using the gym.', link: membershipLink, tone: 'info' });
    }
  }

  const pending = claims.data?.pending;
  if (pending) {
    reminders.push({ key: `upi-${pending.id}`, title: `UPI payment of ${formatMoney(pending.amount_paise, gym.currency)} waiting`, body: 'The gym will confirm it once they see the money.', link: membershipLink, tone: 'info' });
  }

  const soon = now + 24 * 3_600_000;
  for (const c of schedule.data ?? []) {
    const starts = new Date(c.starts_at).getTime();
    if (c.status === 'scheduled' && c.my_status === 'booked' && starts > now && starts <= soon) {
      const day = relativeDay(todayIn(gym.timezone, new Date(c.starts_at)), today);
      reminders.push({ key: `class-${c.id}`, title: `${c.class_name} ${day.toLowerCase()} at ${formatTime(c.starts_at, gym.timezone)}`, body: [c.trainer_name, c.room].filter(Boolean).join(' · ') || null, link: '/classes', tone: 'info' });
    }
  }
  return reminders;
}

// For the bell: unread updates, or anything that needs attention.
export function useNotificationBadge() {
  const notifications = useNotifications();
  const reminders = useReminders();
  const unread = (notifications.data ?? []).filter((n) => n.unread).length;
  return { unread, attention: reminders.some((r) => r.tone === 'bad'), show: unread > 0 || reminders.some((r) => r.tone === 'bad') };
}
