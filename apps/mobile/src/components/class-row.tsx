import { canMemberCancel, formatTime, hasStarted, spotsLeft, type ScheduledClass } from '@gymos/shared';
import { View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useBookClass, useCancelBooking } from '@/lib/classes';
import { confirm } from '@/lib/confirm';

// One class in the schedule with its book / waitlist / cancel action.
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

  let status: string;
  if (item.status === 'cancelled') status = `Cancelled${item.cancel_reason ? ` — ${item.cancel_reason}` : ''}`;
  else if (item.my_status === 'booked') status = 'You’re booked ✓';
  else if (item.my_status === 'waitlisted') status = 'You’re on the waitlist';
  else if (item.my_status === 'attended') status = 'Attended ✓';
  else if (left === 0) status = `Full · ${item.waitlist_count} waiting`;
  else status = `${left} ${left === 1 ? 'spot' : 'spots'} left`;

  const highlight = item.my_status === 'booked' || item.my_status === 'attended';

  function action() {
    if (item.my_status === 'attended') return null;
    if (item.my_status === 'booked' || item.my_status === 'waitlisted') {
      if (!canMemberCancel(item, cancelCutoffHours)) {
        return <Text variant="small">Cancellation closes {cancelCutoffHours} h before the class.</Text>;
      }
      return (
        <Button
          title={item.my_status === 'booked' ? 'Cancel booking' : 'Leave waitlist'}
          variant="secondary"
          onPress={confirmCancel}
          loading={busy}
        />
      );
    }
    return <Button title={left > 0 ? 'Book' : 'Join waitlist'} onPress={() => book.mutate(item.id)} loading={busy} />;
  }

  return (
    <Card style={highlight ? { borderColor: theme.brand } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="heading">{item.class_name}</Text>
        <Text variant="heading">{formatTime(item.starts_at, timezone)}</Text>
      </View>
      <Text variant="muted">
        {item.duration_min} min{item.trainer_name ? ` · ${item.trainer_name}` : ''}
        {item.room ? ` · ${item.room}` : ''}
      </Text>
      <Text
        style={{
          color: item.status === 'cancelled' ? theme.danger : highlight ? theme.brand : theme.textSecondary,
          fontWeight: '600',
        }}>
        {status}
      </Text>
      {(book.error || cancel.error) && <Text variant="error">{(book.error ?? cancel.error)!.message}</Text>}
      {item.status === 'scheduled' && !started && action()}
    </Card>
  );
}
