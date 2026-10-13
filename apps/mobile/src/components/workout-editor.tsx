import { formatSet, num } from '@gymos/shared';
import { Check, Dumbbell, Minus, Plus, Search, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion';
import { Card, Chip, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useExercises, type DraftExercise, type DraftSet, type ExerciseInfo } from '@/lib/workouts';

// Pieces shared by the live workout logger (workout/log) and the editor for a
// saved workout (workout/[logId]).

export const emptySet = (): DraftSet => ({ reps: '', weight: '', seconds: '', done: false });
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

type LastSet = { reps: number | null; weight_kg: number | string | null; duration_sec: number | null };

// One exercise with its sets. "live" mode ticks sets as done and shows last
// time's numbers; "edit" mode (a saved workout) removes individual sets instead.
export function ExerciseCard({ ex, number, mode = 'live', last, onSet, onToggle, onAddSet, onRemoveSet, onRemove }: {
  ex: DraftExercise;
  number: number;
  mode?: 'live' | 'edit';
  last?: LastSet[];
  onSet: (si: number, patch: Partial<DraftSet>) => void;
  onToggle?: (si: number) => void;
  onAddSet: () => void;
  // Live: removes the last set. Edit: removes the set at `si`.
  onRemoveSet: (si: number) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const live = mode === 'live';
  const measure = ex.exercise.measure;
  const done = ex.sets.filter((s) => s.done).length;
  const complete = live && done === ex.sets.length;
  const green = theme.tints.green;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: complete ? theme.accent : theme.surfaceMuted }}>
          {complete ? <Check size={16} color={theme.accentText} strokeWidth={3} /> : <Text style={{ fontWeight: '800' }}>{number}</Text>}
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
        {live && <Text variant="small" style={{ flex: 1.2, fontWeight: '700' }}>LAST TIME</Text>}
        {measure === 'weight_reps' && <Text variant="small" style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>KG</Text>}
        <Text variant="small" style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>{measure === 'time' ? 'SEC' : 'REPS'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {ex.sets.map((s, si) => {
        const prev = last?.[si];
        return (
          <View
            key={si}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4, borderRadius: 14, backgroundColor: live && s.done ? green.bg : 'transparent' }}>
            <Text style={{ width: 28, textAlign: 'center', fontWeight: '800', color: live && s.done ? green.fg : theme.textSecondary }}>{si + 1}</Text>
            {live && <Text variant="small" style={{ flex: 1.2 }} numberOfLines={1}>{prev ? formatSet(prev, measure) : '—'}</Text>}
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
            {live ? (
              <PressableScale
                onPress={() => onToggle?.(si)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.done }}
                accessibilityLabel={`Set ${si + 1} done`}
                style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? theme.chart : theme.surfaceMuted }}>
                <Check size={20} color={s.done ? '#ffffff' : theme.textSecondary} strokeWidth={3} />
              </PressableScale>
            ) : (
              <Pressable
                onPress={() => onRemoveSet(si)}
                disabled={ex.sets.length === 1}
                accessibilityRole="button"
                accessibilityLabel={`Remove set ${si + 1}`}
                style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted, opacity: ex.sets.length === 1 ? 0.3 : pressed ? 0.6 : 1 })}>
                <Trash2 size={18} color={theme.danger} />
              </Pressable>
            )}
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SmallButton icon={Plus} label="Add set" onPress={onAddSet} />
        {live && ex.sets.length > 1 && <SmallButton icon={Minus} label="Remove set" onPress={() => onRemoveSet(ex.sets.length - 1)} />}
      </View>
    </Card>
  );
}

export function SmallButton({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
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

export function NumberField({ value, onChange, placeholder, label, decimal }: {
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

export function ExercisePicker({ visible, onClose, onPick }: {
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
