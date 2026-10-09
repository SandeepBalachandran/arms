import {
  describeOpenStatus,
  formatClock,
  formatRange,
  HOURS_DAY_LABELS,
  HOURS_DAYS,
  openStatus,
  parseOpeningHours,
  todayHoursDay,
  type DayHours,
} from '@gymos/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Pulse } from '@/components/motion';
import { Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';

// "Open now · until 10:00 am"; tap for the week's morning and evening hours.
export function HoursCard() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const [expanded, setExpanded] = useState(false);
  if (!gym) return null;

  const hours = parseOpeningHours(gym.opening_hours);
  const status = openStatus(hours, gym.timezone);
  const today = todayHoursDay(gym.timezone);

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((e) => !e)}
        style={{ gap: Spacing.one }}>
        <Text variant="small">Gym hours</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          {status.open ? <Pulse color={theme.chart} size={9} /> : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.danger }} />}
          <Text variant="heading" style={{ flex: 1 }}>
            {describeOpenStatus(status)}
          </Text>
          <Text variant="muted">{expanded ? 'Hide' : 'Week'}</Text>
        </View>
      </Pressable>
      <DayTimeline day={hours[today]} timezone={gym.timezone} />
      {expanded && (
        <View style={{ marginTop: Spacing.two, gap: Spacing.one }}>
          {HOURS_DAYS.map((day) => {
            const weight = day === today ? '700' : '400';
            const d = hours[day];
            return (
              <View key={day} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                <Text style={{ fontWeight: weight, width: 96 }}>{HOURS_DAY_LABELS[day]}</Text>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  {!d.morning && !d.evening && <Text variant="muted">Closed</Text>}
                  {d.morning && <Text style={{ fontWeight: weight }}>{formatRange(d.morning)}</Text>}
                  {d.evening && <Text style={{ fontWeight: weight }}>{formatRange(d.evening)}</Text>}
                </View>
              </View>
            );
          })}
          {gym.opening_hours_note && (
            <Text variant="muted" style={{ marginTop: Spacing.one }}>
              {gym.opening_hours_note}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Today as a 24-hour strip: open sessions filled, with a marker at "now".
function DayTimeline({ day, timezone }: { day: DayHours; timezone: string }) {
  const theme = useTheme();
  const nowParts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const now = minutes(nowParts) / 1440;
  const sessions = [day.morning, day.evening].filter((r): r is [string, string] => !!r);
  const label = sessions.length
    ? `Open today ${sessions.map(([a, b]) => `${formatClock(a)} to ${formatClock(b)}`).join(' and ')}`
    : 'Closed today';
  return (
    <View accessible accessibilityLabel={label} style={{ marginTop: Spacing.two, gap: 4 }}>
      <View style={{ height: 14, borderRadius: 7, backgroundColor: theme.surfaceMuted, overflow: 'hidden' }}>
        {sessions.map(([a, b]) => (
          <View
            key={a}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(minutes(a) / 1440) * 100}%`,
              width: `${((minutes(b) - minutes(a)) / 1440) * 100}%`,
              backgroundColor: theme.chart,
              borderRadius: 7,
            }}
          />
        ))}
      </View>
      {/* Now marker */}
      <View style={{ position: 'absolute', top: -3, left: `${now * 100}%`, marginLeft: -1, width: 2, height: 20, borderRadius: 1, backgroundColor: theme.text }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {['12a', '6a', '12p', '6p', '12a'].map((t, i) => (
          <Text key={i} style={{ fontSize: 11, color: theme.textSecondary }}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}
