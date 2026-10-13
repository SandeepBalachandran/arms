import { addDays, groupPlanDays, todayIn } from '@gymos/shared';
import { Redirect, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Clock, Dumbbell, Play, Scale, Trophy, Weight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear, Float, PressableScale } from '@/components/motion';
import { Card, Chip, Loading, SectionHeader, Text } from '@/components/ui';
import { Spacing, type Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import {
  nextPlanDay,
  useBodyMetrics,
  useMyPlans,
  usePersonalRecords,
  useWorkoutHistory,
  type WorkoutHistoryItem,
} from '@/lib/workouts';

type Plan = NonNullable<ReturnType<typeof useMyPlans>['data']>[number];
type PlanDay = ReturnType<typeof groupPlanDays<Plan['workout_plan_items'][number]>>[number];

const DAY_TINTS: Tint[] = ['green', 'blue', 'pink', 'yellow'];
// Rough session length: about two and a half minutes per set, rest included.
const minutesFor = (sets: number) => Math.max(10, Math.round((sets * 2.5) / 5) * 5);
const kg = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-IN'));
const muscles = (day: PlanDay) => [...new Set(day.items.map((i) => i.exercises.muscle_group))];
const totalSets = (day: PlanDay) => day.items.reduce((n, i) => n + i.sets, 0);

export default function WorkoutsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const gym = useActiveGym()?.gym;
  const plans = useMyPlans();
  const history = useWorkoutHistory();
  const metrics = useBodyMetrics();
  const records = usePersonalRecords();
  const [refreshing, setRefreshing] = useState(false);

  // The gym turned workouts off while this screen was open.
  if (gym && !gym.workouts_enabled) return <Redirect href="/" />;
  if (!gym || plans.isPending || history.isPending) return <Loading />;

  async function refresh() {
    setRefreshing(true);
    await Promise.all([plans.refetch(), history.refetch(), metrics.refetch(), records.refetch()]);
    setRefreshing(false);
  }

  const logs = history.data ?? [];
  const plan = plans.data?.[0];
  const days = plan ? groupPlanDays(plan.workout_plan_items) : [];
  const next = plan && days.length ? days.find((d) => d.label === nextPlanDay(days.map((x) => x.label), plan.id, logs)) : undefined;

  // This week runs Monday to today, in the gym's time zone.
  const today = todayIn(gym.timezone);
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const dayOf = (log: WorkoutHistoryItem) => todayIn(gym.timezone, new Date(log.performed_at));
  const week = logs.filter((l) => dayOf(l) >= monday);
  const latestWeight = [...(metrics.data ?? [])].reverse().find((m) => m.weight_kg !== null)?.weight_kg;
  const start = (day?: PlanDay) =>
    router.push(day && plan ? { pathname: '/workout/log', params: { planId: plan.id, day: day.label } } : '/workout/log');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.brand} />}>
        <Appear index={0}>
          <Text variant="title">Workouts</Text>
          <Text variant="muted">
            {week.length ? `${week.length} ${week.length === 1 ? 'workout' : 'workouts'} this week. Keep it up!` : plan ? 'Ready when you are' : 'Log any workout, any day'}
          </Text>
        </Appear>

        <Appear index={1}>
          {next ? <UpNext day={next} index={days.indexOf(next)} of={days.length} onStart={() => start(next)} /> : <FreeStart onStart={() => start()} />}
        </Appear>

        <Appear index={2} style={{ flexDirection: 'row', gap: 10 }}>
          <Stat tint="green" icon={Dumbbell} value={String(week.length)} label="This week" />
          <Stat tint="blue" icon={Weight} value={kg(week.reduce((n, l) => n + l.volumeKg, 0))} label="kg lifted" />
          <Stat tint="yellow" icon={Clock} value={String(week.reduce((n, l) => n + (l.duration_min ?? 0), 0))} label="minutes" />
        </Appear>

        {plan && (
          <Appear index={3} style={{ gap: 10 }}>
            <SectionHeader title={plan.name} action={next ? 'Other workout' : undefined} onAction={() => start()} />
            {plan.description && <Text variant="muted">{plan.description}</Text>}
            {days.map((day, i) => (
              <PlanDayRow
                key={day.label}
                day={day}
                tint={DAY_TINTS[i % DAY_TINTS.length]}
                number={i + 1}
                isNext={day === next}
                doneOn={week.find((l) => l.plan_id === plan.id && l.day_label === day.label)}
                onStart={() => start(day)}
              />
            ))}
          </Appear>
        )}

        {!!records.data?.length && (
          <Appear index={4} style={{ gap: 10 }}>
            <SectionHeader title="Personal bests" action="Progress" onAction={() => router.push('/progress')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {records.data.slice(0, 5).map((r) => (
                <Card key={r.name} style={{ width: 150, gap: 4 }}>
                  <Trophy size={18} color={theme.tints.yellow.fg} />
                  <Text style={{ fontWeight: '700' }} numberOfLines={1}>{r.name}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800' }}>{r.weight} kg</Text>
                  <Text variant="small">× {r.reps} reps</Text>
                </Card>
              ))}
            </ScrollView>
          </Appear>
        )}

        <Appear index={5}>
          <PressableScale onPress={() => router.push('/progress')} accessibilityRole="button" accessibilityLabel="Open progress">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: theme.tints.pink.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Scale size={20} color={theme.tints.pink.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>Body and progress</Text>
                <Text variant="small">{latestWeight ? `Latest weight ${latestWeight} kg` : 'Log your weight to see the trend'}</Text>
              </View>
              <ChevronRight size={20} color={theme.textSecondary} />
            </Card>
          </PressableScale>
        </Appear>

        {logs.length > 0 && (
          <Appear index={6} style={{ gap: 10 }}>
            <SectionHeader title="History" count={logs.length} />
            <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
              {logs.map((log, i) => (
                <HistoryRow key={log.id} log={log} first={i === 0} />
              ))}
            </Card>
          </Appear>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Dark card: the next day of the plan, with one big Start button.
function UpNext({ day, index, of, onStart }: { day: PlanDay; index: number; of: number; onStart: () => void }) {
  const theme = useTheme();
  const sets = totalSets(day);
  return (
    <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, overflow: 'hidden', padding: 20, gap: 10 }}>
      <View style={{ position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(200,240,75,0.12)' }} />
      <Float style={{ position: 'absolute', right: 20, top: 20 }}>
        <Dumbbell size={54} color={theme.accent} strokeWidth={1.5} />
      </Float>
      <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>
        UP NEXT · DAY {index + 1} OF {of}
      </Text>
      <Text style={{ color: theme.heroText, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginRight: 70 }}>{day.label}</Text>
      <Text style={{ color: theme.heroText, fontWeight: '600' }}>
        {day.items.length} exercises · {sets} sets · ~{minutesFor(sets)} min
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {muscles(day).map((m) => (
          <Chip key={m} tone="hero">{m}</Chip>
        ))}
      </View>
      <StartButton title="Start workout" onPress={onStart} />
    </Card>
  );
}

// No plan yet: still one tap to start, and a nudge to ask for a plan.
function FreeStart({ onStart }: { onStart: () => void }) {
  const theme = useTheme();
  return (
    <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, overflow: 'hidden', padding: 20, gap: 10 }}>
      <View style={{ position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(200,240,75,0.12)' }} />
      <Float style={{ position: 'absolute', right: 20, top: 20 }}>
        <Dumbbell size={54} color={theme.accent} strokeWidth={1.5} />
      </Float>
      <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>TRAIN YOUR WAY</Text>
      <Text style={{ color: theme.heroText, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginRight: 70 }}>Log a workout</Text>
      <Text style={{ color: theme.heroMuted }}>
        Pick exercises as you go. Ask your trainer for a plan and it will show up here.
      </Text>
      <StartButton title="Start a workout" onPress={onStart} />
    </Card>
  );
}

function StartButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      style={{ marginTop: 6, minHeight: 52, borderRadius: 999, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Play size={18} color={theme.accentText} fill={theme.accentText} />
      <Text style={{ color: theme.accentText, fontWeight: '800', fontSize: 16 }}>{title}</Text>
    </PressableScale>
  );
}

function Stat({ tint, icon: Icon, value, label }: { tint: Tint; icon: typeof Dumbbell; value: string; label: string }) {
  const theme = useTheme();
  const t = theme.tints[tint];
  return (
    <View style={{ flex: 1, borderRadius: 20, padding: 14, gap: 6, backgroundColor: t.bg }} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon size={18} color={t.fg} />
      <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="small">{label}</Text>
    </View>
  );
}

// One plan day: tap to see its exercises, then start it.
function PlanDayRow({ day, tint, number, isNext, doneOn, onStart }: {
  day: PlanDay;
  tint: Tint;
  number: number;
  isNext: boolean;
  doneOn?: WorkoutHistoryItem;
  onStart: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const t = theme.tints[tint];
  const Arrow = open ? ChevronDown : ChevronRight;
  return (
    <Card style={{ gap: 0, padding: 0, overflow: 'hidden', borderColor: isNext ? theme.brand : theme.border }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 18, color: t.fg }}>{number}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{day.label}</Text>
          <Text variant="small" numberOfLines={1}>
            {day.items.length} exercises · {muscles(day).join(', ')}
          </Text>
        </View>
        {doneOn ? (
          <Chip>{`Done ${new Date(doneOn.performed_at).toLocaleDateString('en-IN', { weekday: 'short' })}`}</Chip>
        ) : isNext ? (
          <Chip tone="accent">Next</Chip>
        ) : null}
        <Arrow size={18} color={theme.textSecondary} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
          {day.items.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: theme.border, paddingTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{item.exercises.name}</Text>
                {item.notes && <Text variant="small">{item.notes}</Text>}
              </View>
              <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {item.sets} × {item.reps}
              </Text>
            </View>
          ))}
          <PressableScale
            onPress={onStart}
            accessibilityRole="button"
            style={{ minHeight: 46, borderRadius: 999, backgroundColor: theme.hero, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Play size={16} color={theme.accent} fill={theme.accent} />
            <Text style={{ color: theme.heroText, fontWeight: '700' }}>Start {day.label}</Text>
          </PressableScale>
        </View>
      )}
    </Card>
  );
}

function HistoryRow({ log, first }: { log: WorkoutHistoryItem; first: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const d = new Date(log.performed_at);
  const details = [`${log.sets} sets`, log.duration_min ? `${log.duration_min} min` : null, log.volumeKg ? `${kg(log.volumeKg)} kg` : null].filter(Boolean);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/workout/[logId]', params: { logId: log.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${log.day_label ?? 'Workout'} on ${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${details.join(', ')}. Edit`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 46, alignItems: 'center', borderRadius: 14, paddingVertical: 6, backgroundColor: theme.surfaceMuted }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>
          {d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
        </Text>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>{d.getDate()}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '700' }} numberOfLines={1}>{log.day_label ?? 'Workout'}</Text>
        <Text variant="small" numberOfLines={1}>{details.join(' · ')}</Text>
      </View>
      <ChevronRight size={18} color={theme.textSecondary} />
    </Pressable>
  );
}
