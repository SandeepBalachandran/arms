import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useMyVisits, useSelfCheckIn } from '@/lib/checkins';
import { useActiveGym } from '@/lib/gyms';

// Shown on Home only when the gym has check-in turned on.
export function CheckinCard() {
  const theme = useTheme();
  const router = useRouter();
  const gym = useActiveGym()?.gym;
  const visits = useMyVisits();
  const checkIn = useSelfCheckIn();
  if (!gym?.checkin_enabled) return null;

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { timeZone: gym.timezone, hour: 'numeric', minute: '2-digit' });

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="small">Check-in</Text>
        <Text variant="small">
          {visits.thisMonth} {visits.thisMonth === 1 ? 'day' : 'days'} this month
        </Text>
      </View>
      {visits.todayVisit ? (
        <Text variant="heading" style={{ color: theme.brand }}>
          Checked in today at {time(visits.todayVisit.checked_in_at)} ✓
        </Text>
      ) : gym.checkin_self_allowed ? (
        <Button title="I’m at the gym — check in" onPress={() => checkIn.mutate()} loading={checkIn.isPending} />
      ) : (
        <Text variant="muted">Show your QR code at the front desk to check in.</Text>
      )}
      {checkIn.error && <Text variant="error">{checkIn.error.message}</Text>}
      <Button title="Show my QR code" variant="secondary" onPress={() => router.push('/checkin-qr')} />
    </Card>
  );
}
