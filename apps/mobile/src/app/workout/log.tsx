import { formatSet } from '@gymos/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Input, Loading, Text } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import {
  useExercises,
  useLastSets,
  useMyPlans,
  useSaveWorkout,
  type DraftExercise,
  type DraftSet,
  type ExerciseInfo,
} from '@/lib/workouts';

const emptySet = (): DraftSet => ({ reps: '', weight: '', seconds: '', done: false });
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

function Logger({ planId, dayLabel, initial }: { planId: string | null; dayLabel: string | null; initial: DraftExercise[] }) {
  const theme = useTheme();
  const router = useRouter();
  const [startedAt] = useState(() => Date.now());
  const [exercises, setExercises] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(startedAt);
  const save = useSaveWorkout();
  const lastSets = useLastSets(exercises.map((e) => e.exercise.id));

  useEffect(() => {
    if (!restUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [restUntil]);
  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;

  function updateSet(ei: number, si: number, patch: Partial<DraftSet>) {
    setExercises((list) =>
      list.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })),
    );
  }

  function toggleDone(ei: number, si: number) {
    const set = exercises[ei].sets[si];
    updateSet(ei, si, { done: !set.done });
    if (!set.done) {
      const start = Date.now();
      setNow(start);
      setRestUntil(start + (exercises[ei].restSec ?? DEFAULT_REST) * 1000);
    }
  }

  function addExercise(exercise: ExerciseInfo) {
    setExercises((list) => [...list, { exercise, restSec: null, sets: [emptySet(), emptySet(), emptySet()] }]);
    setPicking(false);
  }

  function finish() {
    save.mutate(
      { planId, dayLabel, startedAt, exercises },
      { onSuccess: () => router.back() },
    );
  }

  async function leave() {
    const anyDone = exercises.some((e) => e.sets.some((s) => s.done));
    if (!anyDone) return router.back();
    const ok = await confirm({ title: 'Discard this workout?', message: 'Your sets will not be saved.', confirmText: 'Discard', cancelText: 'Keep logging' });
    if (ok) router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text variant="title">{dayLabel ?? 'Workout'}</Text>
        {exercises.length === 0 && <Text variant="muted">Add your first exercise to start.</Text>}

        {exercises.map((ex, ei) => {
          const last = lastSets.data?.get(ex.exercise.id);
          const measure = ex.exercise.measure;
          return (
            <Card key={`${ex.exercise.id}-${ei}`}>
              <Text variant="heading">{ex.exercise.name}</Text>
              {ex.target && <Text variant="small">Target: {ex.target}</Text>}
              {last && (
                <Text variant="small">
                  Last time: {last.sets.map((s) => formatSet(s, measure)).join(', ')}
                </Text>
              )}
              {ex.sets.map((s, si) => (
                <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  <Text variant="small" style={{ width: 20 }}>{si + 1}</Text>
                  {measure === 'weight_reps' && (
                    <NumberField value={s.weight} onChange={(weight) => updateSet(ei, si, { weight })} placeholder="kg" decimal />
                  )}
                  {measure !== 'time' ? (
                    <NumberField value={s.reps} onChange={(reps) => updateSet(ei, si, { reps })} placeholder="reps" />
                  ) : (
                    <NumberField value={s.seconds} onChange={(seconds) => updateSet(ei, si, { seconds })} placeholder="seconds" />
                  )}
                  <Pressable
                    onPress={() => toggleDone(ei, si)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: s.done }}
                    accessibilityLabel={`Set ${si + 1} done`}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: Radius,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: s.done ? theme.brand : theme.surface,
                      borderWidth: 1,
                      borderColor: s.done ? theme.brand : theme.border,
                    }}>
                    <Text style={{ color: s.done ? theme.brandText : theme.textSecondary, fontWeight: '700' }}>✓</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  setExercises((list) => list.map((e, i) => (i === ei ? { ...e, sets: [...e.sets, emptySet()] } : e)))
                }>
                <Text style={{ color: theme.brand, fontWeight: '600', paddingVertical: Spacing.one }}>+ Add set</Text>
              </Pressable>
            </Card>
          );
        })}

        <Button title="+ Add exercise" variant="secondary" onPress={() => setPicking(true)} />
        {save.error && <Text variant="error">{save.error.message}</Text>}
        <Button title="Finish workout" onPress={finish} loading={save.isPending} disabled={exercises.length === 0} />
        <Button title="Cancel" variant="secondary" onPress={leave} />
      </ScrollView>

      {restLeft > 0 && (
        <View
          style={{
            position: 'absolute',
            left: Spacing.three,
            right: Spacing.three,
            bottom: Spacing.five,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: Spacing.three,
            borderRadius: Radius,
            backgroundColor: theme.text,
          }}>
          <Text style={{ color: theme.background, fontWeight: '600' }}>
            Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
          </Text>
          <Pressable onPress={() => setRestUntil(null)} accessibilityRole="button">
            <Text style={{ color: theme.background }}>Skip</Text>
          </Pressable>
        </View>
      )}

      <ExercisePicker visible={picking} onClose={() => setPicking(false)} onPick={addExercise} />
    </SafeAreaView>
  );
}

function NumberField({ value, onChange, placeholder, decimal }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  decimal?: boolean;
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      style={{
        flex: 1,
        minHeight: 44,
        borderWidth: 1,
        borderRadius: Radius,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        color: theme.text,
        paddingHorizontal: Spacing.two,
        fontSize: 16,
        fontFamily: Fonts.regular,
        textAlign: 'center',
      }}
    />
  );
}

function ExercisePicker({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (e: ExerciseInfo) => void;
}) {
  const theme = useTheme();
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises.data ?? []).filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q),
    );
  }, [exercises.data, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: Spacing.three, gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading">Add exercise</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={{ color: theme.brand }}>Close</Text>
          </Pressable>
        </View>
        <Input value={query} onChangeText={setQuery} placeholder="Search, e.g. squat or chest" autoCorrect={false} />
        <FlatList
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item)} style={{ paddingVertical: Spacing.two, borderBottomWidth: 1, borderColor: theme.border }}>
              <Text>{item.name}</Text>
              <Text variant="small">{item.muscle_group}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
