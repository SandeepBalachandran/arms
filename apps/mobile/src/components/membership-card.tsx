import { formatDate } from '@gymos/shared';
import { View } from 'react-native';

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
      return (
        <Card style={warn ? { borderColor: theme.danger } : undefined}>
          <Text variant="small">Membership · {state.current.plan_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 40, fontWeight: '700', color: warn ? theme.danger : theme.brand }}>
              {state.daysLeft}
            </Text>
            <Text variant="muted">{state.daysLeft === 1 ? 'day left' : 'days left'}</Text>
          </View>
          <Text variant="muted">
            Valid till {formatDate(state.next?.ends_on ?? state.current.ends_on)}
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
