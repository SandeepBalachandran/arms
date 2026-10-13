import { num } from '@gymos/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Dumbbell, Plus, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseGuideSheet } from '@/components/exercise-guide';
import { Appear, GrowFill } from '@/components/motion';
import { Button, Card, Loading, Text } from '@/components/ui';
import { clock, emptySet, ExerciseCard, ExercisePicker } from '@/components/workout-editor';
import { Spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import {
  useExerciseGuides,
  useLastSets,
  useMyPlans,
  useSaveWorkout,
  workoutVolume,
  type DraftExercise,
  type DraftSet,
  type ExerciseInfo,
} from '@/lib/workouts';

const DEFAULT_REST = 90;

// Logs one workout: a plan day (planId + day params) or an empty session.
// Kept in local state and saved in one go on Finish.
export default function WorkoutLogScreen() {
  const { planId, day } = useLocalSearchParams<{ planId?: string; day?: string }>();
  const plans = useMyPlans();
  if (planId && plans.isPending) return <Loading />;

  const plan = plans.data?.find((p) => p.id === planId);
  const items = plan?.workout_plan_items
    .filter((i) => i.day_label === day)
    .sort((a, b) => a.position - b.position);
  const initial: DraftExercise[] = (items ?? []).map((i) => ({
    exercise: i.exercises,
    restSec: i.rest_sec,
    target: `${i.sets} × ${i.reps}${i.notes ? ` · ${i.notes}` : ''}`,
    sets: Array.from({ length: i.sets }, emptySet),
  }));

  return <Logger planId={plan?.id ?? null} dayLabel={plan ? (day ?? null) : null} initial={initial} />;
}

type Summary = { minutes: number; sets: number; volume: number; exercises: number };

function Logger({ planId, dayLabel, initial }: { planId: string | null; dayLabel: string | null; initial: DraftExercise[] }) {
  const theme = useTheme();
  const router = useRouter();
  const [startedAt] = useState(() => Date.now());
  const [exercises, setExercises] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [now, setNow] = useState(startedAt);
  const [summary, setSummary] = useState<Summary | null>(null);
  const save = useSaveWorkout();
  const lastSets = useLastSets(exercises.map((e) => e.exercise.id));
  const guides = useExerciseGuides();
  const [guideFor, setGuideFor] = useState<ExerciseInfo | null>(null);

  // One tick a second drives the workout clock and the rest timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;
  const elapsed = Math.floor((now - startedAt) / 1000);
  const allSets = exercises.flatMap((e) => e.sets);
  const doneCount = allSets.filter((s) => s.done).length;

  function updateExercise(ei: number, fn: (ex: DraftExercise) => DraftExercise) {
    setExercises((list) => list.map((ex, i) => (i === ei ? fn(ex) : ex)));
  }
  function updateSet(ei: number, si: number, patch: Partial<DraftSet>) {
    updateExercise(ei, (ex) => ({ ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));
  }

  // Ticking a set fills empty fields from last time (shown as placeholders),
  // so repeating last session is one tap per set. Then the rest timer starts.
  function toggleDone(ei: number, si: number) {
    const ex = exercises[ei];
    const set = ex.sets[si];
    const prev = lastSets.data?.get(ex.exercise.id)?.sets[si];
    updateSet(ei, si, set.done ? { done: false } : {
      done: true,
      weight: set.weight || (prev?.weight_kg != null ? String(num(prev.weight_kg)) : ''),
      reps: set.reps || (prev?.reps != null ? String(prev.reps) : ''),
      seconds: set.seconds || (prev?.duration_sec != null ? String(prev.duration_sec) : ''),
    });
    if (!set.done) {
      // Runs on tap only; the compiler can't tell, as it's passed down as a prop.
      // eslint-disable-next-line react-hooks/purity
      const start = Date.now();
      const total = ex.restSec ?? DEFAULT_REST;
      setNow(start);
      setRest({ until: start + total * 1000, total });
    }
  }

  function addExercise(exercise: ExerciseInfo) {
    setExercises((list) => [...list, { exercise, restSec: null, sets: [emptySet(), emptySet(), emptySet()] }]);
    setPicking(false);
  }

  // Removes a set; a ticked one is confirmed first since it would be logged.
  async function removeSet(ei: number, si: number) {
    const set = exercises[ei].sets[si];
    if (set.done) {
      const ok = await confirm({ title: `Remove set ${si + 1}?`, message: 'It is ticked as done and will not be saved.', confirmText: 'Remove' });
      if (!ok) return;
    }
    updateExercise(ei, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== si) }));
  }

  async function removeExercise(ei: number) {
    const ex = exercises[ei];
    if (ex.sets.some((s) => s.done)) {
      const ok = await confirm({ title: `Remove ${ex.exercise.name}?`, message: 'Its ticked sets will not be saved.', confirmText: 'Remove' });
      if (!ok) return;
    }
    setExercises((list) => list.filter((_, i) => i !== ei));
  }

  function finish() {
    const done = exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);
    save.mutate(
      { planId, dayLabel, startedAt, exercises },
      {
        onSuccess: () =>
          setSummary({
            minutes: Math.max(1, Math.round((Date.now() - startedAt) / 60_000)),
            sets: doneCount,
            exercises: done.length,
            volume: workoutVolume(
              done.flatMap((e) => (e.exercise.measure === 'weight_reps' ? e.sets : [])).map((s) => ({ reps: Number(s.reps) || 0, weight_kg: s.weight.replace(',', '.') })),
            ),
          }),
      },
    );
  }

  async function leave() {
    if (!doneCount) return router.back();
    const ok = await confirm({ title: 'Discard this workout?', message: 'Your sets will not be saved.', confirmText: 'Discard', cancelText: 'Keep logging' });
    if (ok) router.back();
  }

  if (summary) return <Done summary={summary} title={dayLabel ?? 'Workout'} onClose={() => router.back()} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
        <Appear index={0}>
          <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>{dayLabel ? 'PLAN WORKOUT' : 'YOUR WORKOUT'}</Text>
                <Text style={{ color: theme.heroText, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>{dayLabel ?? 'Workout'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`Time ${clock(elapsed)}`}>
                <Clock size={16} color={theme.accent} />
                <Text style={{ color: theme.heroText, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{clock(elapsed)}</Text>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                <GrowFill fraction={allSets.length ? doneCount / allSets.length : 0} delay={0} style={{ height: '100%', borderRadius: 4, backgroundColor: theme.accent }} />
              </View>
              <Text style={{ color: theme.heroMuted, fontSize: 13 }}>
                {doneCount} of {allSets.length} sets done · {exercises.length} exercises
              </Text>
            </View>
          </Card>
        </Appear>

        {exercises.length === 0 && (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={32} color={theme.textSecondary} />
            </View>
            <Text style={{ fontWeight: '700' }}>Add your first exercise</Text>
            <Text variant="muted" style={{ textAlign: 'center' }}>Search by name or muscle, like “bench” or “legs”.</Text>
          </View>
        )}

        {exercises.map((ex, ei) => (
          <Appear key={`${ex.exercise.id}-${ei}`} index={ei + 1}>
            <ExerciseCard
              ex={ex}
              number={ei + 1}
              last={lastSets.data?.get(ex.exercise.id)?.sets}
              onGuide={guides.data?.has(ex.exercise.id) ? () => setGuideFor(ex.exercise) : undefined}
              onSet={(si, patch) => updateSet(ei, si, patch)}
              onToggle={(si) => toggleDone(ei, si)}
              onAddSet={() => updateExercise(ei, (e) => ({ ...e, sets: [...e.sets, emptySet()] }))}
              onRemoveSet={(si) => removeSet(ei, si)}
              onRemove={() => removeExercise(ei)}
            />
          </Appear>
        ))}

        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 52, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
          <Plus size={18} color={theme.text} />
          <Text style={{ fontWeight: '700' }}>Add exercise</Text>
        </Pressable>
        <Pressable onPress={leave} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={{ color: theme.danger, fontWeight: '600' }}>Discard workout</Text>
        </Pressable>
      </ScrollView>

      <View style={{ position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three, gap: 10 }}>
        {restLeft > 0 && rest && (
          <RestBar left={restLeft} total={rest.total} onAdd={() => setRest((r) => r && { until: r.until + 15_000, total: r.total + 15 })} onSkip={() => setRest(null)} />
        )}
        {save.error && <Text variant="error" style={{ textAlign: 'center' }}>{save.error.message}</Text>}
        <Button
          title={doneCount ? `Finish workout · ${doneCount} ${doneCount === 1 ? 'set' : 'sets'}` : 'Finish workout'}
          onPress={finish}
          loading={save.isPending}
          disabled={!doneCount}
        />
      </View>

      <ExercisePicker visible={picking} onClose={() => setPicking(false)} onPick={addExercise} />
      <ExerciseGuideSheet exercise={guideFor} guide={guideFor ? guides.data?.get(guideFor.id) : undefined} onClose={() => setGuideFor(null)} />
    </SafeAreaView>
  );
}

// Floating rest countdown with +15 s and Skip.
function RestBar({ left, total, onAdd, onSkip }: { left: number; total: number; onAdd: () => void; onSkip: () => void }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ borderRadius: 22, backgroundColor: theme.hero, padding: 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.heroMuted, fontSize: 12, fontWeight: '600' }}>REST</Text>
          <Text style={{ color: theme.heroText, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{clock(left)}</Text>
        </View>
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add 15 seconds" style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <Text style={{ color: theme.heroText, fontWeight: '700' }}>+15 s</Text>
        </Pressable>
        <Pressable onPress={onSkip} accessibilityRole="button" style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: theme.accent }}>
          <Text style={{ color: theme.accentText, fontWeight: '700' }}>Skip</Text>
        </Pressable>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${(left / total) * 100}%`, borderRadius: 3, backgroundColor: theme.accent }} />
      </View>
    </View>
  );
}

// Shown after saving: what was done, then back to Workouts.
function Done({ summary, title, onClose }: { summary: Summary; title: string; onClose: () => void }) {
  const theme = useTheme();
  const stats = [
    { value: String(summary.minutes), label: 'minutes' },
    { value: String(summary.sets), label: 'sets' },
    { value: summary.volume ? summary.volume.toLocaleString('en-IN') : String(summary.exercises), label: summary.volume ? 'kg lifted' : 'exercises' },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: Spacing.three, justifyContent: 'center', gap: Spacing.four }} edges={['bottom']}>
      <Appear index={0} style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.hero, alignItems: 'center', justifyContent: 'center' }}>
          <Trophy size={44} color={theme.accent} />
        </View>
        <Text variant="title" style={{ textAlign: 'center' }}>Workout saved!</Text>
        <Text variant="muted" style={{ textAlign: 'center' }}>{title} is done. Great work.</Text>
      </Appear>
      <Appear index={1} style={{ flexDirection: 'row', gap: 10 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flex: 1, alignItems: 'center', borderRadius: 20, paddingVertical: 16, backgroundColor: theme.surfaceMuted }}>
            <Text style={{ fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{s.value}</Text>
            <Text variant="small">{s.label}</Text>
          </View>
        ))}
      </Appear>
      <Appear index={2}>
        <Button title="Done" onPress={onClose} />
      </Appear>
    </SafeAreaView>
  );
}
