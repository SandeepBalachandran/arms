import { formatContainer, formatLitres, type WaterContainer } from '@gymos/shared';
import { useRouter } from 'expo-router';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Input, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSaveWaterSettings, useWaterSettings } from '@/lib/nutrition';

const GOAL_STEP = 250;
const MIN_GOAL = 500;
const MAX_GOAL = 8000;
const MAX_CONTAINERS = 5;
const PRESETS: WaterContainer[] = [
  { label: 'Cup', ml: 150 },
  { label: 'Glass', ml: 250 },
  { label: 'Bottle', ml: 500 },
  { label: 'Steel bottle', ml: 750 },
  { label: 'Big bottle', ml: 1000 },
];

// Daily water goal and the containers shown as quick-add buttons on Food.
export default function WaterSettingsScreen() {
  const settings = useWaterSettings();
  if (settings.isPending) return <Loading />;
  return <Editor initialGoal={settings.data?.goalMl ?? 2500} initialContainers={settings.data?.containers ?? []} />;
}

type Row = { label: string; ml: string };

function Editor({ initialGoal, initialContainers }: { initialGoal: number; initialContainers: WaterContainer[] }) {
  const theme = useTheme();
  const router = useRouter();
  const save = useSaveWaterSettings();
  const [goal, setGoal] = useState(initialGoal);
  const [rows, setRows] = useState<Row[]>(initialContainers.map((c) => ({ label: c.label, ml: String(c.ml) })));
  const tint = theme.tints.blue;

  const setRow = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (c: WaterContainer) => setRows((list) => (list.length < MAX_CONTAINERS ? [...list, { label: c.label, ml: String(c.ml) }] : list));

  function submit() {
    save.mutate(
      { goalMl: goal, containers: rows.map((r) => ({ label: r.label, ml: Number(r.ml) })) },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen>
      <SectionHeader title="Daily goal" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 }}>
        <Stepper icon={Minus} label="Lower goal" disabled={goal <= MIN_GOAL} onPress={() => setGoal((g) => Math.max(MIN_GOAL, g - GOAL_STEP))} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: tint.fg, fontVariant: ['tabular-nums'] }}>{formatLitres(goal)}</Text>
          <Text variant="small">a day · about {Math.round(goal / 250)} glasses</Text>
        </View>
        <Stepper icon={Plus} label="Raise goal" disabled={goal >= MAX_GOAL} onPress={() => setGoal((g) => Math.min(MAX_GOAL, g + GOAL_STEP))} />
      </Card>
      <Text variant="small" style={{ marginTop: -8 }}>Most adults need 2–3 L a day; more on training days and in hot weather.</Text>

      <SectionHeader title="Your containers" count={rows.length} />
      <Text variant="small" style={{ marginTop: -8 }}>Each one becomes a quick-add button. Name it and set how much it holds.</Text>
      {rows.map((r, i) => (
        <Card key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12 }}>
          <View style={{ flex: 1.6 }}>
            <Input label="Name" value={r.label} onChangeText={(label) => setRow(i, { label })} maxLength={20} placeholder="Steel bottle" />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Size (ml)"
              value={r.ml}
              onChangeText={(ml) => setRow(i, { ml: ml.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="750"
            />
          </View>
          <Pressable
            onPress={() => setRows((list) => list.filter((_, j) => j !== i))}
            disabled={rows.length === 1}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${r.label || 'container'}`}
            style={({ pressed }) => ({ width: 48, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted, opacity: rows.length === 1 ? 0.3 : pressed ? 0.6 : 1 })}>
            <Trash2 size={18} color={theme.danger} />
          </Pressable>
        </Card>
      ))}

      {rows.length < MAX_CONTAINERS && (
        <View style={{ gap: 8 }}>
          <Text variant="small">Add one</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => addRow(p)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${p.label}, ${formatContainer(p.ml)}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
                <Plus size={14} color={theme.text} />
                <Text style={{ fontSize: 13, fontWeight: '600' }}>{p.label}</Text>
                <Text variant="small">{formatContainer(p.ml)}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => addRow({ label: '', ml: 0 })}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
              <Plus size={14} color={theme.text} />
              <Text style={{ fontSize: 13, fontWeight: '600' }}>Custom</Text>
            </Pressable>
          </View>
        </View>
      )}

      {save.error && <Text variant="error">{save.error.message}</Text>}
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}

function Stepper({ icon: Icon, label, disabled, onPress }: { icon: typeof Plus; label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 })}>
      <Icon size={20} color={theme.text} />
    </Pressable>
  );
}
