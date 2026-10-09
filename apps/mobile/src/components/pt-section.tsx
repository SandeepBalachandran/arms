import { formatDate, formatDuration, formatMoney, formatSessions, formatSessionsLeft } from '@gymos/shared';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useMyPt, usePtPackages } from '@/lib/pt';

// Membership tab: the member's PT package and, if the gym shows them, the
// packages on offer. Renders nothing when the gym doesn't offer PT.
export function PtSection() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const mine = useMyPt();
  const packages = usePtPackages();
  if (!gym?.pt_enabled) return null;

  const current = mine.data?.filter((s) => s.state.kind === 'active' || s.state.kind === 'upcoming') ?? [];
  const recent = current.flatMap((s) => s.sessions).slice(0, 5);
  const offered = gym.pt_show_in_app ? (packages.data ?? []) : [];
  if (current.length === 0 && offered.length === 0) return null;

  return (
    <>
      <Text variant="heading">Personal training</Text>
      {current.map((s) => {
        const used = s.sessions.length;
        const pct = s.sessions_total ? Math.min(100, (used / s.sessions_total) * 100) : null;
        return (
          <Card key={s.id}>
            <Text variant="small">
              {s.package_name}
              {s.trainer_name ? ` · with ${s.trainer_name}` : ''}
            </Text>
            <Text variant="heading">{formatSessionsLeft(s, used)}</Text>
            {pct !== null && (
              <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: theme.brand }} />
              </View>
            )}
            <Text variant="muted">
              {s.state.kind === 'upcoming' ? `Starts ${formatDate(s.starts_on)}` : `Use by ${formatDate(s.ends_on)}`}
            </Text>
          </Card>
        );
      })}
      {recent.length > 0 && (
        <Card style={{ gap: Spacing.one }}>
          <Text variant="small">Recent sessions</Text>
          {recent.map((x, i) => (
            <View key={i}>
              <Text>{formatDate(x.session_on)}</Text>
              {x.notes && <Text variant="muted">{x.notes}</Text>}
            </View>
          ))}
        </Card>
      )}
      {offered.length > 0 && (
        <>
          <Text variant="muted">Personal training packages. Ask at the front desk to start.</Text>
          {offered.map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text variant="heading" style={{ flex: 1 }}>
                  {p.name}
                </Text>
                <Text variant="heading" style={{ color: theme.brand }}>
                  {formatMoney(p.price_paise, gym.currency)}
                </Text>
              </View>
              <Text variant="muted">
                {formatSessions(p.sessions)} · {p.sessions ? 'use within' : 'for'} {formatDuration(p.validity_days)}
              </Text>
              {p.description && <Text variant="muted">{p.description}</Text>}
            </Card>
          ))}
        </>
      )}
    </>
  );
}
