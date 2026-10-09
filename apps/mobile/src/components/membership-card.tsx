import { daysBetween, formatDate } from '@gymos/shared';
import { View } from 'react-native';

import { GrowFill, useCountUp } from '@/components/motion';
import { Card, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useMembership } from '@/lib/memberships';

// Membership status at the top of the Membership tab.
export function MembershipCard() {
  const theme = useTheme();
  const { state, isPending } = useMembership();
  const warnDays = useActiveGym()?.gym.expiry_warning_days ?? 7;

  if (isPending || !state) {
    return (
      <Card>
        <Text variant="small">Membership</Text>
        <Text variant="muted">Loading…</Text>
      </Card>
    );
  }

  switch (state.kind) {
    case 'active': {
      const warn = state.daysLeft <= warnDays;
      const end = state.next?.ends_on ?? state.current.ends_on;
      return (
        <Card style={warn ? { borderColor: theme.danger } : undefined}>
          <Text variant="small">Membership · {state.current.plan_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <CountUp value={state.daysLeft} color={warn ? theme.danger : theme.brand} />
            <Text variant="muted">{state.daysLeft === 1 ? 'day left' : 'days left'}</Text>
          </View>
          <Timeline start={state.current.starts_on} end={end} daysLeft={state.daysLeft} warn={warn} />
          <Text variant="muted">
            Valid till {formatDate(end)}
            {state.next ? ` (renewed: ${state.next.plan_name})` : ''}
          </Text>
          {warn && !state.next && <Text variant="error">Renew soon to keep training without a break.</Text>}
        </Card>
      );
    }
    case 'upcoming':
      return (
        <Card>
          <Text variant="small">Membership · {state.next.plan_name}</Text>
          <Text variant="heading">Starts {formatDate(state.next.starts_on)}</Text>
          <Text variant="muted">Valid till {formatDate(state.next.ends_on)}</Text>
        </Card>
      );
    case 'expired':
      return (
        <Card style={{ borderColor: theme.danger }}>
          <Text variant="small">Membership · {state.last.plan_name}</Text>
          <Text variant="heading" style={{ color: theme.danger }}>
            Expired on {formatDate(state.last.ends_on)}
          </Text>
          <Text variant="muted">Renew at the front desk to continue.</Text>
        </Card>
      );
    case 'none':
      return (
        <Card>
          <Text variant="small">Membership</Text>
          <Text variant="heading">No active plan</Text>
          <Text variant="muted">Pick a plan below and pay at the front desk to start.</Text>
        </Card>
      );
  }
}

function CountUp({ value, color }: { value: number; color: string }) {
  const shown = Math.round(useCountUp(value, 900));
  return <Text style={{ fontSize: 44, fontWeight: '800', letterSpacing: -1, color, fontVariant: ['tabular-nums'] }}>{shown}</Text>;
}

// Start → end of the membership as a bar filled up to today.
function Timeline({ start, end, daysLeft, warn }: { start: string; end: string; daysLeft: number; warn: boolean }) {
  const theme = useTheme();
  const total = daysBetween(start, end) + 1;
  const used = Math.min(1, Math.max(0, (total - daysLeft) / total));
  return (
    <View accessible accessibilityLabel={`Day ${total - daysLeft} of ${total}`} style={{ gap: 4 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.surfaceMuted, overflow: 'hidden' }}>
        <GrowFill fraction={used} style={{ height: '100%', borderRadius: 5, backgroundColor: warn ? theme.danger : theme.chart }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="small">{formatDate(start)}</Text>
        <Text variant="small">{formatDate(end)}</Text>
      </View>
    </View>
  );
}
