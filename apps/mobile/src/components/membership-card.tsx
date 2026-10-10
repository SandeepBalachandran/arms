import { daysBetween, formatDate } from '@gymos/shared';
import { Image, View } from 'react-native';

import { GrowFill, useCountUp } from '@/components/motion';
import { Card, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useMembership } from '@/lib/memberships';

// Membership as a dark "pass": gym, plan, days left and a timeline.
export function MembershipCard() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const { state, isPending } = useMembership();
  const warnDays = gym?.expiry_warning_days ?? 7;

  if (isPending || !state) {
    return <Pass><Text style={{ color: theme.heroMuted }}>Loading…</Text></Pass>;
  }

  switch (state.kind) {
    case 'active': {
      const warn = state.daysLeft <= warnDays && !state.next;
      const end = state.next?.ends_on ?? state.current.ends_on;
      return (
        <Pass status={warn ? { text: 'Renew soon', tone: 'warn' } : { text: 'Active', tone: 'good' }}>
          <Text style={{ color: theme.heroMuted, fontSize: 14 }}>{state.current.plan_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <CountUp value={state.daysLeft} color={warn ? '#fbbf24' : theme.accent} />
            <Text style={{ color: theme.heroText, fontSize: 16, fontWeight: '600' }}>{state.daysLeft === 1 ? 'day left' : 'days left'}</Text>
          </View>
          <Timeline start={state.current.starts_on} end={end} daysLeft={state.daysLeft} warn={warn} />
          {state.next && (
            <Text style={{ color: theme.heroMuted, fontSize: 13 }}>Renewed: {state.next.plan_name} continues to {formatDate(state.next.ends_on)}</Text>
          )}
        </Pass>
      );
    }
    case 'upcoming':
      return (
        <Pass status={{ text: 'Starts soon', tone: 'good' }}>
          <Text style={{ color: theme.heroMuted, fontSize: 14 }}>{state.next.plan_name}</Text>
          <Text style={{ color: theme.heroText, fontSize: 26, fontWeight: '800' }}>Starts {formatDate(state.next.starts_on)}</Text>
          <Text style={{ color: theme.heroMuted }}>Valid till {formatDate(state.next.ends_on)}</Text>
        </Pass>
      );
    case 'expired':
      return (
        <Pass status={{ text: 'Expired', tone: 'bad' }}>
          <Text style={{ color: theme.heroMuted, fontSize: 14 }}>{state.last.plan_name}</Text>
          <Text style={{ color: theme.heroText, fontSize: 24, fontWeight: '800' }}>Ended {formatDate(state.last.ends_on)}</Text>
          <Text style={{ color: theme.heroMuted }}>Pick a plan below to renew and keep training.</Text>
        </Pass>
      );
    case 'none':
      return (
        <Pass>
          <Text style={{ color: theme.heroText, fontSize: 24, fontWeight: '800' }}>No active plan</Text>
          <Text style={{ color: theme.heroMuted }}>Pick a plan below to start training.</Text>
        </Pass>
      );
  }
}

const TONES = {
  good: { bg: '#c8f04b', fg: '#141a04' },
  warn: { bg: '#fbbf24', fg: '#3b2a00' },
  bad: { bg: '#f87171', fg: '#3b0a0a' },
};

function Pass({ status, children }: { status?: { text: string; tone: keyof typeof TONES }; children: React.ReactNode }) {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  return (
    <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, padding: 20, gap: 10, overflow: 'hidden' }}>
      {/* Decorative rings. */}
      <View style={{ position: 'absolute', right: -60, bottom: -70, width: 200, height: 200, borderRadius: 100, borderWidth: 28, borderColor: 'rgba(200,240,75,0.10)' }} />
      <View style={{ position: 'absolute', right: 40, top: -40, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {gym?.logo_url ? (
          <Image source={{ uri: gym.logo_url }} style={{ width: 36, height: 36, borderRadius: 10 }} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '800', color: theme.accentText }}>{gym?.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.heroText, fontWeight: '700' }} numberOfLines={1}>{gym?.name}</Text>
          <Text style={{ color: theme.heroMuted, fontSize: 12 }}>Membership pass</Text>
        </View>
        {status && (
          <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: TONES[status.tone].bg }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: TONES[status.tone].fg }}>{status.text}</Text>
          </View>
        )}
      </View>
      {children}
    </Card>
  );
}

function CountUp({ value, color }: { value: number; color: string }) {
  const shown = Math.round(useCountUp(value, 900));
  return <Text style={{ fontSize: 56, lineHeight: 64, fontWeight: '800', letterSpacing: -2, color, fontVariant: ['tabular-nums'] }}>{shown}</Text>;
}

// Start → end of the membership as a bar filled up to today.
function Timeline({ start, end, daysLeft, warn }: { start: string; end: string; daysLeft: number; warn: boolean }) {
  const theme = useTheme();
  const total = daysBetween(start, end) + 1;
  const used = Math.min(1, Math.max(0, (total - daysLeft) / total));
  return (
    <View accessible accessibilityLabel={`Day ${total - daysLeft} of ${total}`} style={{ gap: 6 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
        <GrowFill fraction={used} style={{ height: '100%', borderRadius: 4, backgroundColor: warn ? '#fbbf24' : theme.accent }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.heroMuted, fontSize: 12 }}>{formatDate(start)}</Text>
        <Text style={{ color: theme.heroMuted, fontSize: 12 }}>Valid till {formatDate(end)}</Text>
      </View>
    </View>
  );
}
