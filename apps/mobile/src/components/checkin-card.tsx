import { checkinOpenNow, describeOpenStatus, openStatus, parseOpeningHours } from '@gymos/shared';
import { useRouter } from 'expo-router';
import { CircleCheck, Moon, QrCode, ScanLine } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
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
  // Re-check opening hours every minute while Home is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!gym?.checkin_enabled) return null;

  const hours = parseOpeningHours(gym.opening_hours);
  // The gym only takes member check-ins during opening hours (staff still can).
  const closed = gym.checkin_only_when_open && !checkinOpenNow(hours, gym.timezone);
  const canSelf = !visits.todayVisit && !closed;

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { timeZone: gym.timezone, hour: 'numeric', minute: '2-digit' });

  const open = !closed;
  const status = describeOpenStatus(openStatus(hours, gym.timezone));

  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, padding: Spacing.three, gap: 10 }}>
      {visits.todayVisit ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
            <CircleCheck size={22} color={theme.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>Checked in at {time(visits.todayVisit.checked_in_at)}</Text>
            <Text variant="small">Have a great workout! · {visits.thisMonth} {visits.thisMonth === 1 ? 'visit' : 'visits'} this month</Text>
          </View>
        </View>
      ) : closed && (gym.checkin_self_allowed || gym.checkin_poster_enabled) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Moon size={20} color={theme.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{gym.name} is closed now</Text>
            <Text variant="small">{status}</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700' }}>{gym.checkin_self_allowed || gym.checkin_poster_enabled ? 'Check in' : 'Check in at the desk'}</Text>
            <Text variant="small">{open ? `${visits.thisMonth} ${visits.thisMonth === 1 ? 'visit' : 'visits'} this month` : status}</Text>
          </View>
          {canSelf && (gym.checkin_poster_enabled || gym.checkin_self_allowed) && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {gym.checkin_poster_enabled && (
                <CardButton
                  icon={<ScanLine size={18} color={theme.accentText} />}
                  label="Scan poster"
                  a11y="Scan the gym's poster to check in"
                  primary
                  onPress={() => router.push('/checkin-scan')}
                />
              )}
              {gym.checkin_self_allowed && !gym.checkin_poster_enabled && (
                <CardButton
                  icon={<CircleCheck size={18} color={theme.accentText} />}
                  label={checkIn.isPending ? 'Checking in…' : 'Check in'}
                  primary
                  disabled={checkIn.isPending}
                  onPress={() => checkIn.mutate()}
                />
              )}
            </View>
          )}
        </>
      )}
      <Pressable
        onPress={() => router.push('/checkin-qr')}
        accessibilityRole="button"
        accessibilityLabel="Show my QR code"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, borderRadius: 999, backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.7 : 1 })}>
        <QrCode size={16} color={theme.text} />
        <Text style={{ fontWeight: '700', fontSize: 13 }}>Show my QR at the desk</Text>
      </Pressable>
      {checkIn.error && <Text variant="error">{checkIn.error.message}</Text>}
    </View>
  );
}

function CardButton({ icon, label, a11y, primary, disabled, onPress }: {
  icon: ReactNode;
  label: string;
  a11y?: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 999, backgroundColor: primary ? theme.accent : theme.surfaceMuted, opacity: pressed || disabled ? 0.7 : 1 })}>
      {icon}
      <Text style={{ fontWeight: '800', color: primary ? theme.accentText : theme.text }}>{label}</Text>
    </Pressable>
  );
}
