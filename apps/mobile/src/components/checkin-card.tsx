import { useRouter } from 'expo-router';
import { CircleCheck, QrCode, ScanLine } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
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
    <View style={{ borderRadius: 20, borderWidth: 1, borderColor: theme.border, padding: Spacing.three, gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <View style={{ flex: 1, gap: 2 }}>
          {visits.todayVisit ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CircleCheck size={18} color={theme.brand} />
              <Text style={{ fontWeight: '700' }}>Checked in at {time(visits.todayVisit.checked_in_at)}</Text>
            </View>
          ) : (
            <Text style={{ fontWeight: '700' }}>
              {gym.checkin_self_allowed || gym.checkin_poster_enabled ? 'At the gym?' : 'Check in at the desk'}
            </Text>
          )}
          <Text variant="small">
            {visits.thisMonth} {visits.thisMonth === 1 ? 'visit' : 'visits'} this month
          </Text>
        </View>
        {!visits.todayVisit && gym.checkin_poster_enabled && (
          <Pressable
            onPress={() => router.push('/checkin-scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan the gym's poster to check in"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
            <ScanLine size={18} color={theme.accentText} />
            <Text style={{ color: theme.accentText, fontWeight: '700' }}>Scan</Text>
          </Pressable>
        )}
        {!visits.todayVisit && gym.checkin_self_allowed && !gym.checkin_poster_enabled && (
          <Pressable
            onPress={() => checkIn.mutate()}
            disabled={checkIn.isPending}
            accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, opacity: pressed || checkIn.isPending ? 0.7 : 1 })}>
            <Text style={{ color: theme.accentText, fontWeight: '700' }}>{checkIn.isPending ? 'Checking in…' : 'Check in'}</Text>
          </Pressable>
        )}
        <IconButton label="Show my QR code" onPress={() => router.push('/checkin-qr')}>
          <QrCode size={22} color={theme.text} />
        </IconButton>
      </View>
      {checkIn.error && <Text variant="error">{checkIn.error.message}</Text>}
    </View>
  );
}
