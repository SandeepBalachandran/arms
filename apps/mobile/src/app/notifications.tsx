import { timeAgo, type NotificationView } from '@gymos/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { Apple, BellOff, CalendarDays, ChevronRight, CreditCard, Dumbbell, HeartHandshake, ReceiptText, type LucideIcon } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear } from '@/components/motion';
import { Card, Loading, SectionHeader, Text } from '@/components/ui';
import { Spacing, type Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMarkNotificationsRead, useNotifications, useReminders } from '@/lib/notifications';

// By where the notification leads.
const ICONS: Record<string, LucideIcon> = {
  '/receipt': ReceiptText,
  '/membership': CreditCard,
  '/classes': CalendarDays,
  '/food': Apple,
  '/workouts': Dumbbell,
};

function iconKey(view: NotificationView) {
  return view.link?.startsWith('/receipt/') ? '/receipt' : (view.link ?? '');
}

const TONE_TINT: Record<NotificationView['tone'], Tint> = { good: 'green', bad: 'pink', info: 'blue' };

// Reminders that need attention, then recent updates from the gym. Updates
// are marked read when you leave the screen, so the "new" dots stay while
// you look.
export default function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const reminders = useReminders();
  const { mutate: markRead } = useMarkNotificationsRead();

  // On leaving the screen (a no-op when nothing is unread).
  useFocusEffect(useCallback(() => () => markRead(), [markRead]));

  if (notifications.isPending) return <Loading />;
  const items = notifications.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
        refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => notifications.refetch()} />}>
        {reminders.length > 0 && (
          <Appear index={0} style={{ gap: 10 }}>
            <SectionHeader title="Needs attention" />
            {reminders.map((r) => (
              <Row key={r.key} view={r} highlight />
            ))}
          </Appear>
        )}

        <Appear index={1} style={{ gap: 10 }}>
          <SectionHeader title="Updates" />
          {items.length === 0 ? (
            <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
              <BellOff size={26} color={theme.textSecondary} />
              <Text style={{ fontWeight: '700' }}>You&apos;re all caught up</Text>
              <Text variant="muted" style={{ textAlign: 'center' }}>
                Payments, class changes and messages from your trainer show up here.
              </Text>
            </Card>
          ) : (
            <Card style={{ padding: 6, gap: 0 }}>
              {items.map((n, i) => (
                <View key={n.id} style={{ borderTopWidth: i ? 1 : 0, borderColor: theme.border }}>
                  <Row view={n} unread={n.unread} time={timeAgo(n.createdAt)} />
                </View>
              ))}
            </Card>
          )}
        </Appear>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ view, unread, time, highlight }: { view: NotificationView; unread?: boolean; time?: string; highlight?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const tint = theme.tints[TONE_TINT[view.tone]];
  const Icon = ICONS[iconKey(view)] ?? HeartHandshake;
  const label = [unread ? 'New.' : null, view.title, view.body, time].filter(Boolean).join(', ');

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: highlight ? 14 : 10 }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: highlight ? theme.surface : tint.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={view.tone === 'bad' ? theme.danger : tint.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: unread || highlight ? '700' : '600' }}>{view.title}</Text>
        {view.body && <Text variant="small" numberOfLines={3}>{view.body}</Text>}
        {time && <Text variant="small" style={{ fontSize: 12 }}>{time}</Text>}
      </View>
      {unread && <View accessibilityElementsHidden style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.brand }} />}
      {view.link && <ChevronRight size={18} color={theme.textSecondary} />}
    </View>
  );

  const body = highlight ? (
    <View style={{ borderRadius: 20, backgroundColor: tint.bg }}>{content}</View>
  ) : (
    content
  );
  if (!view.link) return <View accessible accessibilityLabel={label}>{body}</View>;
  return (
    <Pressable
      onPress={() => router.push(view.link!)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  );
}
