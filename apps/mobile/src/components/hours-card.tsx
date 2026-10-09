import {
  describeOpenStatus,
  formatRange,
  HOURS_DAY_LABELS,
  HOURS_DAYS,
  openStatus,
  parseOpeningHours,
  todayHoursDay,
} from '@gymos/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

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
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.open ? theme.brand : theme.danger }} />
          <Text variant="heading" style={{ flex: 1 }}>
            {describeOpenStatus(status)}
          </Text>
          <Text variant="muted">{expanded ? 'Hide' : 'Week'}</Text>
        </View>
      </Pressable>
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
