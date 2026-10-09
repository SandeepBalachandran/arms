import { dayKey, formatDay, todayIn } from '@gymos/shared';
import { useState } from 'react';
import { RefreshControl, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClassRow } from '@/components/class-row';
import { Loading, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSchedule } from '@/lib/classes';
import { useActiveGym } from '@/lib/gyms';

export default function ClassesScreen() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const schedule = useSchedule();
  const [refreshing, setRefreshing] = useState(false);
  if (!gym) return null;
  if (schedule.isPending) return <Loading />;

  const today = todayIn(gym.timezone);
  const sections = [...Map.groupBy(schedule.data ?? [], (c) => dayKey(c.starts_at, gym.timezone))].map(
    ([day, data]) => ({ title: day === today ? `Today · ${formatDay(day)}` : formatDay(day), data }),
  );

  async function refresh() {
    setRefreshing(true);
    await schedule.refetch();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.brand} />}
        ListHeaderComponent={<Text variant="title">Classes</Text>}
        ListEmptyComponent={<Text variant="muted">No classes scheduled this week.</Text>}
        renderSectionHeader={({ section }) => (
          <Text variant="small" style={{ marginTop: Spacing.three, fontWeight: '600' }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => <ClassRow item={item} timezone={gym.timezone} />}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}
