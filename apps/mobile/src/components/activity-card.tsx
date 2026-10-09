import { Flame } from 'lucide-react-native';
import { View } from 'react-native';

import { GrowBar, useCountUp } from '@/components/motion';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivity } from '@/lib/activity';

const TRACK = 84;

// "This week" infographic: active days as bars (Mon–Sun), a count-up total
// and the current streak. One series, so no legend; the label says it all.
export function ActivityCard() {
  const theme = useTheme();
  const activity = useActivity();
  const shown = Math.round(useCountUp(activity.weekDays, 800));
  if (!activity.available) return null;

  const activeNames = activity.week.filter((d) => d.count > 0).map((d) => d.label);
  const summary =
    `This week: ${activity.weekDays} of 7 days active${activeNames.length ? ` (${activeNames.join(', ')})` : ''}. ` +
    `${activity.streak}-day streak. ${activity.monthDays} active days this month.`;

  return (
    <View
      accessible
      accessibilityLabel={summary}
      style={{ borderRadius: 24, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, padding: Spacing.three, gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Text variant="small">This week</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{shown}</Text>
            <Text variant="muted">/ 7 active days</Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: activity.streak ? theme.accent : theme.surfaceMuted,
          }}>
          <Flame size={16} color={activity.streak ? theme.accentText : theme.textSecondary} fill={activity.streak ? theme.accentText : 'none'} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: activity.streak ? theme.accentText : theme.textSecondary }}>
            {activity.streak ? `${activity.streak}-day streak` : 'Start a streak'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: TRACK }}>
        {activity.week.map((d, i) => {
          const height = d.count > 0 ? 34 + Math.min(d.count - 1, 2) * 25 : 8;
          return (
            <View key={d.day} style={{ width: 30, height: TRACK, justifyContent: 'flex-end', alignItems: 'center' }}>
              {/* Track, then the bar on top, anchored to the baseline. */}
              <View style={{ position: 'absolute', bottom: 0, width: 30, height: TRACK, borderRadius: 10, backgroundColor: theme.surfaceMuted, opacity: d.isFuture ? 0.5 : 1 }} />
              <GrowBar
                height={height}
                delay={120 + i * 70}
                style={{
                  width: 30,
                  borderRadius: 10,
                  backgroundColor: d.count > 0 ? theme.chart : 'transparent',
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -Spacing.two }}>
        {activity.week.map((d) => (
          <View key={d.day} style={{ width: 30, alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: d.isToday ? '800' : '500', color: d.isToday ? theme.text : theme.textSecondary }}>
              {d.label.slice(0, 1)}
            </Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.isToday ? theme.text : 'transparent' }} />
          </View>
        ))}
      </View>

      <Text variant="small">
        {activity.monthDays} active {activity.monthDays === 1 ? 'day' : 'days'} this month
      </Text>
    </View>
  );
}
