import { formatDate, formatDuration, formatMoney, formatSessions, formatSessionsLeft } from '@gymos/shared';
import { Dumbbell, HeartHandshake } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { GrowFill } from '@/components/motion';
import { Card, SectionHeader, Text } from '@/components/ui';
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
      <SectionHeader title="Personal training" />
      {current.map((s) => {
        const used = s.sessions.length;
        const pct = s.sessions_total ? Math.min(1, used / s.sessions_total) : null;
        return (
          <Card key={s.id} style={{ padding: 18, gap: 10, backgroundColor: theme.tints.blue.bg, borderColor: theme.tints.blue.bg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                <HeartHandshake size={22} color={theme.tints.blue.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>{s.package_name}</Text>
                {s.trainer_name && <Text variant="small">with {s.trainer_name}</Text>}
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.tints.blue.fg }}>{formatSessionsLeft(s, used)}</Text>
            {s.sessions_total !== null && s.sessions_total <= 40 ? (
              <SessionDots total={s.sessions_total} used={used} />
            ) : (
              pct !== null && (
                <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.surface, overflow: 'hidden' }}>
                  <GrowFill fraction={pct} style={{ height: '100%', borderRadius: 4, backgroundColor: theme.tints.blue.fg }} />
                </View>
              )
            )}
            <Text variant="small">
              {s.state.kind === 'upcoming' ? `Starts ${formatDate(s.starts_on)}` : `Use by ${formatDate(s.ends_on)}`}
            </Text>
          </Card>
        );
      })}
      {recent.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
          <Text variant="small" style={{ paddingTop: Spacing.two, fontWeight: '700' }}>RECENT SESSIONS</Text>
          {recent.map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: theme.border }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.tints.blue.fg, marginTop: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{formatDate(x.session_on)}</Text>
                {x.notes && <Text variant="small">{x.notes}</Text>}
              </View>
            </View>
          ))}
        </Card>
      )}
      {offered.length > 0 && (
        <>
          <Text variant="muted">{current.length ? 'More packages' : 'Packages'} · ask at the front desk to start.</Text>
          {offered.map((p) => (
            <Card key={p.id} style={{ padding: 18, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.tints.pink.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Dumbbell size={22} color={theme.tints.pink.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700' }}>{p.name}</Text>
                  <Text variant="small">
                    {formatSessions(p.sessions)} · {p.sessions ? 'use within' : 'for'} {formatDuration(p.validity_days)}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{formatMoney(p.price_paise, gym.currency)}</Text>
              {p.description && <Text variant="muted">{p.description}</Text>}
            </Card>
          ))}
        </>
      )}
    </>
  );
}

// One dot per session in the pack: filled = used. Pops in one by one.
function SessionDots({ total, used }: { total: number; used: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <View
      accessible
      accessibilityLabel={`${used} of ${total} sessions used`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: Spacing.one }}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          entering={reduced ? undefined : ZoomIn.delay(100 + i * 35).springify()}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: i < used ? theme.tints.blue.fg : theme.surface,
            borderWidth: 2,
            borderColor: i < used ? theme.tints.blue.fg : theme.surface,
          }}
        />
      ))}
    </View>
  );
}
