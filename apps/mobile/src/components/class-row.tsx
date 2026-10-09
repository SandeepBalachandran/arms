import { formatTime, hasStarted, spotsLeft, type ScheduledClass } from '@gymos/shared';
import { Alert, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useBookClass, useCancelBooking } from '@/lib/classes';

// One class in the schedule with its book / waitlist / cancel action.
export function ClassRow({ item, timezone }: { item: ScheduledClass; timezone: string }) {
  const theme = useTheme();
  const book = useBookClass();
  const cancel = useCancelBooking();
  const started = hasStarted(item.starts_at);
  const left = spotsLeft(item);
  const busy = book.isPending || cancel.isPending;

  function confirmCancel() {
    const what = item.my_status === 'waitlisted' ? 'Leave the waitlist' : 'Cancel your spot';
    Alert.alert(`${what}?`, `${item.class_name} at ${formatTime(item.starts_at, timezone)}`, [
      { text: 'Keep it', style: 'cancel' },
      { text: what, style: 'destructive', onPress: () => cancel.mutate(item.my_booking_id!) },
    ]);
  }

  let status: string;
  if (item.status === 'cancelled') status = `Cancelled${item.cancel_reason ? ` — ${item.cancel_reason}` : ''}`;
  else if (item.my_status === 'booked') status = 'You’re booked ✓';
  else if (item.my_status === 'waitlisted') status = 'You’re on the waitlist';
  else if (item.my_status === 'attended') status = 'Attended ✓';
  else if (left === 0) status = `Full · ${item.waitlist_count} waiting`;
  else status = `${left} ${left === 1 ? 'spot' : 'spots'} left`;

  const highlight = item.my_status === 'booked' || item.my_status === 'attended';

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
      {item.status === 'scheduled' && !started && (
        item.my_status === 'booked' || item.my_status === 'waitlisted' ? (
          <Button
            title={item.my_status === 'booked' ? 'Cancel booking' : 'Leave waitlist'}
            variant="secondary"
            onPress={confirmCancel}
            loading={busy}
          />
        ) : (
          item.my_status !== 'attended' && (
            <Button title={left > 0 ? 'Book' : 'Join waitlist'} onPress={() => book.mutate(item.id)} loading={busy} />
          )
        )
      )}
    </Card>
  );
}
