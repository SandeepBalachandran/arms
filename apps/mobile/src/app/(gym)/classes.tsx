import { dayKey, formatTime, groupBy, hasStarted, todayIn, type ScheduledClass } from '@gymos/shared';
import { CalendarDays, CalendarX2, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClassRow } from '@/components/class-row';
import { Appear, Float } from '@/components/motion';
import { Card, Loading, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSchedule } from '@/lib/classes';
import { useActiveGym } from '@/lib/gyms';

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dayParts = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
    date: d.getUTCDate(),
    long: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
  };
};

export default function ClassesScreen() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const schedule = useSchedule();
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  if (!gym) return null;
  if (schedule.isPending) return <Loading />;

  const today = todayIn(gym.timezone);
  const classes = schedule.data ?? [];
  const byDay = groupBy(classes, (c) => dayKey(c.starts_at, gym.timezone));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  // Open on the first day that has something on, unless the member picked one.
  const selected = picked ?? days.find((d) => byDay.get(d)?.some((c) => !hasStarted(c.starts_at))) ?? today;
  const list = byDay.get(selected) ?? [];
  const next = classes
    .filter((c) => c.my_status === 'booked' && c.status === 'scheduled' && !hasStarted(c.starts_at))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const bookedCount = classes.filter((c) => c.my_status === 'booked' && !hasStarted(c.starts_at)).length;

  async function refresh() {
    setRefreshing(true);
    await schedule.refetch();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.three, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.brand} />}
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, marginBottom: 4 }}>
            <Appear index={0}>
              <Text variant="title">Classes</Text>
              <Text variant="muted">
                {bookedCount ? `You're booked into ${bookedCount} ${bookedCount === 1 ? 'class' : 'classes'} this week` : `This week at ${gym.name}`}
              </Text>
            </Appear>
            {next && (
              <Appear index={1}>
                <NextClass item={next} timezone={gym.timezone} today={today} />
              </Appear>
            )}
            <Appear index={2}>
              <DayStrip days={days} today={today} selected={selected} counts={byDay} onPick={setPicked} />
            </Appear>
            <Text style={{ fontSize: 15, fontWeight: '700' }}>{selected === today ? 'Today' : dayParts(selected).long}</Text>
          </View>
        }
        ListEmptyComponent={<EmptyDay />}
        renderItem={({ item, index }) => (
          <Appear index={index + 3}>
            <ClassRow item={item} timezone={gym.timezone} cancelCutoffHours={gym.classes_cancel_cutoff_hours} />
          </Appear>
        )}
      />
    </SafeAreaView>
  );
}

// Seven day chips; a dot marks days with classes.
function DayStrip({ days, today, selected, counts, onPick }: {
  days: string[];
  today: string;
  selected: string;
  counts: Map<string, ScheduledClass[]>;
  onPick: (day: string) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
      {days.map((d) => {
        const active = d === selected;
        const n = counts.get(d)?.length ?? 0;
        const mine = counts.get(d)?.some((c) => c.my_status === 'booked');
        const { weekday, date } = dayParts(d);
        return (
          <Pressable
            key={d}
            onPress={() => onPick(d)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${dayParts(d).long}, ${n} ${n === 1 ? 'class' : 'classes'}`}
            style={{
              width: 58,
              paddingVertical: 12,
              borderRadius: 20,
              alignItems: 'center',
              gap: 2,
              backgroundColor: active ? theme.hero : theme.surfaceMuted,
              borderWidth: d === today && !active ? 1.5 : 0,
              borderColor: theme.brand,
            }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: active ? theme.heroMuted : theme.textSecondary }}>
              {d === today ? 'Today' : weekday}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: active ? theme.accent : theme.text }}>{date}</Text>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: mine ? theme.accent : n ? (active ? theme.heroMuted : theme.textSecondary) : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Dark card for the member's next booked class.
function NextClass({ item, timezone, today }: { item: ScheduledClass; timezone: string; today: string }) {
  const theme = useTheme();
  const day = dayKey(item.starts_at, timezone);
  const when = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : dayParts(day).long;
  return (
    <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, overflow: 'hidden', padding: 20, gap: 6 }}>
      <View style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(200,240,75,0.14)' }} />
      <Float style={{ position: 'absolute', right: 18, top: 18 }}>
        <CalendarDays size={52} color={theme.accent} strokeWidth={1.5} />
      </Float>
      <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>YOUR NEXT CLASS</Text>
      <Text style={{ color: theme.heroText, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{item.class_name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Clock size={15} color={theme.accent} />
        <Text style={{ color: theme.heroText, fontWeight: '600' }}>
          {when} · {formatTime(item.starts_at, timezone)}
        </Text>
      </View>
      {item.trainer_name && <Text style={{ color: theme.heroMuted, fontSize: 14 }}>with {item.trainer_name}</Text>}
    </Card>
  );
}

function EmptyDay() {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 40 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <CalendarX2 size={32} color={theme.textSecondary} />
      </View>
      <Text style={{ fontWeight: '700' }}>No classes this day</Text>
      <Text variant="muted" style={{ textAlign: 'center' }}>Pick another day above, or pull down to refresh.</Text>
    </View>
  );
}
