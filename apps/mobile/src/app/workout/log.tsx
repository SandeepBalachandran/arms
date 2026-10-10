import { formatSet, num } from '@gymos/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clock, Dumbbell, Minus, Plus, Search, Trophy, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear, GrowFill, PressableScale } from '@/components/motion';
import { Button, Card, Chip, Loading, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import {
  useExercises,
  useLastSets,
  useMyPlans,
  useSaveWorkout,
  workoutVolume,
  type DraftExercise,
  type DraftSet,
  type ExerciseInfo,
} from '@/lib/workouts';

const emptySet = (): DraftSet => ({ reps: '', weight: '', seconds: '', done: false });
const DEFAULT_REST = 90;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

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
              onSet={(si, patch) => updateSet(ei, si, patch)}
              onToggle={(si) => toggleDone(ei, si)}
              onAddSet={() => updateExercise(ei, (e) => ({ ...e, sets: [...e.sets, emptySet()] }))}
              onRemoveSet={() => updateExercise(ei, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
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
    </SafeAreaView>
  );
}

type LastSet = { reps: number | null; weight_kg: number | string | null; duration_sec: number | null };

function ExerciseCard({ ex, number, last, onSet, onToggle, onAddSet, onRemoveSet, onRemove }: {
  ex: DraftExercise;
  number: number;
  last?: LastSet[];
  onSet: (si: number, patch: Partial<DraftSet>) => void;
  onToggle: (si: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const measure = ex.exercise.measure;
  const done = ex.sets.filter((s) => s.done).length;
  const canRemoveSet = ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done;
  const green = theme.tints.green;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: done === ex.sets.length ? theme.accent : theme.surfaceMuted }}>
          {done === ex.sets.length ? <Check size={16} color={theme.accentText} strokeWidth={3} /> : <Text style={{ fontWeight: '800' }}>{number}</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{ex.exercise.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip>{ex.exercise.muscle_group}</Chip>
            {ex.target && <Chip>{`Target ${ex.target}`}</Chip>}
            {ex.restSec ? <Chip>{`Rest ${clock(ex.restSec)}`}</Chip> : null}
          </View>
        </View>
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${ex.exercise.name}`}>
          <X size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
        <Text variant="small" style={{ width: 28, fontWeight: '700' }}>SET</Text>
        <Text variant="small" style={{ flex: 1.2, fontWeight: '700' }}>LAST TIME</Text>
        {measure === 'weight_reps' && <Text variant="small" style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>KG</Text>}
        <Text variant="small" style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>{measure === 'time' ? 'SEC' : 'REPS'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {ex.sets.map((s, si) => {
        const prev = last?.[si];
        return (
          <View
            key={si}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4, borderRadius: 14, backgroundColor: s.done ? green.bg : 'transparent' }}>
            <Text style={{ width: 28, textAlign: 'center', fontWeight: '800', color: s.done ? green.fg : theme.textSecondary }}>{si + 1}</Text>
            <Text variant="small" style={{ flex: 1.2 }} numberOfLines={1}>{prev ? formatSet(prev, measure) : '—'}</Text>
            {measure === 'weight_reps' && (
              <NumberField
                value={s.weight}
                onChange={(weight) => onSet(si, { weight })}
                placeholder={prev?.weight_kg != null ? String(num(prev.weight_kg)) : 'kg'}
                label={`Set ${si + 1} weight in kg`}
                decimal
              />
            )}
            {measure !== 'time' ? (
              <NumberField value={s.reps} onChange={(reps) => onSet(si, { reps })} placeholder={prev?.reps != null ? String(prev.reps) : 'reps'} label={`Set ${si + 1} reps`} />
            ) : (
              <NumberField value={s.seconds} onChange={(seconds) => onSet(si, { seconds })} placeholder={prev?.duration_sec != null ? String(prev.duration_sec) : 'sec'} label={`Set ${si + 1} seconds`} />
            )}
            <PressableScale
              onPress={() => onToggle(si)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              accessibilityLabel={`Set ${si + 1} done`}
              style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? theme.chart : theme.surfaceMuted }}>
              <Check size={20} color={s.done ? '#ffffff' : theme.textSecondary} strokeWidth={3} />
            </PressableScale>
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SmallButton icon={Plus} label="Add set" onPress={onAddSet} />
        {canRemoveSet && <SmallButton icon={Minus} label="Remove set" onPress={onRemoveSet} />}
      </View>
    </Card>
  );
}

function SmallButton({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.6 : 1 })}>
      <Icon size={15} color={theme.text} />
      <Text style={{ fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
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

function NumberField({ value, onChange, placeholder, label, decimal }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
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
      accessibilityLabel={label}
      selectTextOnFocus
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 44,
        borderRadius: 12,
        backgroundColor: theme.surfaceMuted,
        color: theme.text,
        paddingHorizontal: 6,
        fontSize: 16,
        fontFamily: Fonts.semibold,
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
  const [group, setGroup] = useState<string | null>(null);
  const groups = useMemo(() => [...new Set((exercises.data ?? []).map((e) => e.muscle_group))], [exercises.data]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises.data ?? []).filter(
      (e) => (!group || e.muscle_group === group) && (!q || e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q)),
    );
  }, [exercises.data, query, group]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: Spacing.three, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading">Add exercise</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: theme.brand, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 14, backgroundColor: theme.surfaceMuted }}>
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search, e.g. squat or chest"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={{ flex: 1, minHeight: 48, color: theme.text, fontFamily: Fonts.regular, fontSize: 16 }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {[null, ...groups].map((g) => {
            const active = group === g;
            return (
              <Pressable
                key={g ?? 'all'}
                onPress={() => setGroup(g)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? theme.hero : theme.surfaceMuted }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: active ? theme.heroText : theme.textSecondary }}>{g ?? 'All'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <FlatList
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick(item)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Dumbbell size={18} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{item.name}</Text>
                <Text variant="small">{item.muscle_group}</Text>
              </View>
              <Plus size={18} color={theme.brand} />
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
