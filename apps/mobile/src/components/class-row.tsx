import { canMemberCancel, formatTime, hasStarted, spotsLeft, type ScheduledClass } from '@gymos/shared';
import { Clock, MapPin, User } from 'lucide-react-native';
import { View } from 'react-native';

import { GrowFill } from '@/components/motion';
import { Button, Card, Text } from '@/components/ui';
import type { Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBookClass, useCancelBooking } from '@/lib/classes';
import { confirm } from '@/lib/confirm';

const TINTS: Tint[] = ['green', 'blue', 'pink', 'yellow'];

// The same class type always gets the same colour.
export function classTint(name: string): Tint {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

// One class: time on the left, details and a fill bar on the right, and the
// book / waitlist / cancel action underneath.
export function ClassRow({ item, timezone, cancelCutoffHours }: {
  item: ScheduledClass;
  timezone: string;
  cancelCutoffHours: number;
}) {
  const theme = useTheme();
  const book = useBookClass();
  const cancel = useCancelBooking();
  const started = hasStarted(item.starts_at);
  const left = spotsLeft(item);
  const busy = book.isPending || cancel.isPending;
  const tint = theme.tints[classTint(item.class_name)];
  const [clock, meridiem] = formatTime(item.starts_at, timezone).split(' ');
  const cancelled = item.status === 'cancelled';
  const mine = item.my_status === 'booked' || item.my_status === 'attended';

  async function confirmCancel() {
    const what = item.my_status === 'waitlisted' ? 'Leave the waitlist' : 'Cancel your spot';
    const ok = await confirm({
      title: `${what}?`,
      message: `${item.class_name} at ${formatTime(item.starts_at, timezone)}`,
      confirmText: what,
      cancelText: 'Keep it',
    });
    if (ok) cancel.mutate(item.my_booking_id!);
  }

  const pill: { text: string; bg: string; fg: string } | null = cancelled
    ? { text: 'Cancelled', bg: 'rgba(220,38,38,0.12)', fg: theme.danger }
    : item.my_status === 'attended' ? { text: 'Attended ✓', bg: theme.accent, fg: theme.accentText }
    : item.my_status === 'booked' ? { text: 'Booked ✓', bg: theme.accent, fg: theme.accentText }
    : item.my_status === 'waitlisted' ? { text: 'On waitlist', bg: tint.bg, fg: tint.fg }
    : left === 0 ? { text: 'Full', bg: theme.surfaceMuted, fg: theme.textSecondary }
    : null;

  function action() {
    if (item.my_status === 'attended') return null;
    if (item.my_status === 'booked' || item.my_status === 'waitlisted') {
      if (!canMemberCancel(item, cancelCutoffHours)) {
        return <Text variant="small">Cancellation closed {cancelCutoffHours} h before the class.</Text>;
      }
      return (
        <Button
          title={item.my_status === 'booked' ? 'Cancel booking' : 'Leave waitlist'}
          variant="secondary"
          onPress={confirmCancel}
          loading={busy}
          style={{ minHeight: 44 }}
        />
      );
    }
    return (
      <Button
        title={left > 0 ? 'Book a spot' : `Join waitlist · ${item.waitlist_count} waiting`}
        onPress={() => book.mutate(item.id)}
        loading={busy}
        style={{ minHeight: 44 }}
      />
    );
  }

  const fill = item.capacity ? Math.min(1, item.booked_count / item.capacity) : 0;

  return (
    <Card style={[{ flexDirection: 'row', gap: 14, padding: 14 }, mine && { borderColor: theme.brand, borderWidth: 1.5 }, cancelled && { opacity: 0.65 }]}>
      {/* Time block in the class's colour. */}
      <View style={{ width: 64, borderRadius: 16, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: tint.fg, letterSpacing: -0.5 }}>{clock}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: tint.fg }}>{meridiem}</Text>
      </View>

      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', flex: 1 }} numberOfLines={1}>{item.class_name}</Text>
          {pill && (
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: pill.bg }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: pill.fg }}>{pill.text}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
          <Meta icon={<Clock size={13} color={theme.textSecondary} />} text={`${item.duration_min} min`} />
          {item.trainer_name && <Meta icon={<User size={13} color={theme.textSecondary} />} text={item.trainer_name} />}
          {item.room && <Meta icon={<MapPin size={13} color={theme.textSecondary} />} text={item.room} />}
        </View>

        {cancelled ? (
          <Text variant="small" style={{ color: theme.danger }}>{item.cancel_reason || 'This class was cancelled.'}</Text>
        ) : (
          <View style={{ gap: 4 }} accessible accessibilityLabel={`${item.booked_count} of ${item.capacity} spots booked`}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.surfaceMuted, overflow: 'hidden' }}>
              <GrowFill fraction={fill} style={{ height: '100%', borderRadius: 3, backgroundColor: left === 0 ? theme.danger : tint.fg }} />
            </View>
            <Text variant="small">
              {left === 0 ? `Full${item.waitlist_count ? ` · ${item.waitlist_count} waiting` : ''}` : `${left} of ${item.capacity} spots left`}
            </Text>
          </View>
        )}

        {(book.error || cancel.error) && <Text variant="error">{(book.error ?? cancel.error)!.message}</Text>}
        {!cancelled && !started && action()}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {icon}
      <Text variant="small">{text}</Text>
    </View>
  );
}
