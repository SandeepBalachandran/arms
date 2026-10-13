import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Input, Loading, Screen, Text } from '@/components/ui';
import { emptySet, ExerciseCard, ExercisePicker, NumberField } from '@/components/workout-editor';
import { Spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { useDeleteWorkout, useUpdateWorkout, useWorkoutLog, type DraftExercise, type DraftSet, type ExerciseInfo } from '@/lib/workouts';

// Edit a saved workout from History: fix reps, weight or time, add or remove
// sets and exercises, change the duration and notes, or delete it.
export default function EditWorkoutScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const log = useWorkoutLog(logId);
  const router = useRouter();

  if (log.isPending) return <Loading />;
  if (!log.data) {
    return (
      <Screen>
        <Text variant="heading">Workout not found</Text>
        <Text variant="muted">It may have been deleted.</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  // Keyed so a refetch after saving starts a fresh draft.
  return <Editor key={log.dataUpdatedAt} log={log.data} />;
}

type Log = NonNullable<ReturnType<typeof useWorkoutLog>['data']>;

function Editor({ log }: { log: Log }) {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateWorkout();
  const remove = useDeleteWorkout();
  const [exercises, setExercises] = useState<DraftExercise[]>(log.exercises);
  const [duration, setDuration] = useState(log.duration_min != null ? String(log.duration_min) : '');
  const [notes, setNotes] = useState(log.notes ?? '');
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const originalSetIds = log.exercises.flatMap((e) => e.sets.flatMap((s) => (s.id ? [s.id] : [])));
  const performed = new Date(log.performed_at);

  function change(fn: (list: DraftExercise[]) => DraftExercise[]) {
    setExercises(fn);
    setDirty(true);
  }
  function updateExercise(ei: number, fn: (ex: DraftExercise) => DraftExercise) {
    change((list) => list.map((ex, i) => (i === ei ? fn(ex) : ex)));
  }
  function updateSet(ei: number, si: number, patch: Partial<DraftSet>) {
    updateExercise(ei, (ex) => ({ ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));
  }
  async function removeExercise(ei: number) {
    const ok = await confirm({ title: `Remove ${exercises[ei].exercise.name}?`, message: 'All its sets are removed from this workout when you save.', confirmText: 'Remove' });
    if (ok) change((list) => list.filter((_, i) => i !== ei));
  }
  function addExercise(exercise: ExerciseInfo) {
    change((list) => [...list, { exercise, restSec: null, sets: [{ ...emptySet(), done: true }] }]);
    setPicking(false);
  }

  function save() {
    update.mutate(
      { logId: log.id, durationMin: duration ? Math.min(600, Number(duration)) : null, notes, exercises, originalSetIds },
      { onSuccess: () => router.back() },
    );
  }

  async function deleteWorkout() {
    const ok = await confirm({ title: 'Delete this workout?', message: 'Its sets are removed from your history and records. This can’t be undone.', confirmText: 'Delete' });
    if (ok) remove.mutate(log.id, { onSuccess: () => router.back() });
  }

  async function leave() {
    if (!dirty) return router.back();
    const ok = await confirm({ title: 'Discard your changes?', message: 'The workout stays as it was.', confirmText: 'Discard', cancelText: 'Keep editing' });
    if (ok) router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color={theme.accent} />
            <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>
              {performed.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()} ·{' '}
              {performed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={{ color: theme.heroText, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>
            {log.day_label ?? 'Workout'}
          </Text>
          {log.workout_plans?.name && <Text style={{ color: theme.heroMuted, fontSize: 13 }}>{log.workout_plans.name}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>Duration (min)</Text>
            <View style={{ width: 90 }}>
              <NumberField value={duration} onChange={(v) => { setDuration(v); setDirty(true); }} placeholder="min" label="Duration in minutes" />
            </View>
          </View>
        </Card>

        {exercises.map((ex, ei) => (
          <ExerciseCard
            key={`${ex.exercise.id}-${ei}`}
            ex={ex}
            number={ei + 1}
            mode="edit"
            onSet={(si, patch) => updateSet(ei, si, patch)}
            onAddSet={() => updateExercise(ei, (e) => ({ ...e, sets: [...e.sets, { ...emptySet(), done: true }] }))}
            onRemoveSet={(si) => updateExercise(ei, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== si) }))}
            onRemove={() => removeExercise(ei)}
          />
        ))}

        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 52, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
          <Plus size={18} color={theme.text} />
          <Text style={{ fontWeight: '700' }}>Add exercise</Text>
        </Pressable>

        <Input label="Notes" value={notes} onChangeText={(v) => { setNotes(v); setDirty(true); }} placeholder="How did it feel?" maxLength={500} multiline />

        <Pressable onPress={deleteWorkout} disabled={remove.isPending} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={{ color: theme.danger, fontWeight: '600' }}>{remove.isPending ? 'Deleting…' : 'Delete workout'}</Text>
        </Pressable>
        {remove.error && <Text variant="error" style={{ textAlign: 'center' }}>{remove.error.message}</Text>}
      </ScrollView>

      <View style={{ position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three, gap: 10 }}>
        {update.error && <Text variant="error" style={{ textAlign: 'center' }}>{update.error.message}</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Cancel" variant="secondary" onPress={leave} style={{ flex: 1 }} />
          <Button title="Save changes" onPress={save} loading={update.isPending} disabled={!dirty} style={{ flex: 2 }} />
        </View>
      </View>

      <ExercisePicker visible={picking} onClose={() => setPicking(false)} onPick={addExercise} />
    </SafeAreaView>
  );
}
