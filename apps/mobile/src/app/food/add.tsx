import { addDays, MEAL_LABELS, type Food, type MealSlot } from '@gymos/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Copy, Minus, Plus, Search, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Input, Text } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAddFoodLogs, useFoodLogs, useFoods, useNutritionProfile, type NewFoodLog } from '@/lib/nutrition';

const TYPE_DOT = { veg: '#16a34a', egg: '#d97706', nonveg: '#dc2626' } as const;

export default function AddFoodScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { meal, day } = useLocalSearchParams<{ meal: MealSlot; day: string }>();
  const foods = useFoods();
  const logs = useFoodLogs(7);
  const pref = useNutritionProfile().data?.food_pref;
  const add = useAddFoodLogs();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);
  const [quick, setQuick] = useState(false);

  // Recently eaten foods first (by name), then the full list.
  const recentNames = useMemo(() => {
    const seen = new Set<string>();
    for (const l of [...(logs.data ?? [])].reverse()) if (l.food_id) seen.add(l.food_id);
    return [...seen];
  }, [logs.data]);
  const yesterday = (logs.data ?? []).filter((l) => l.logged_on === addDays(day, -1) && l.meal === meal);

  const list = useMemo(() => {
    const all = (foods.data ?? []).filter((f) => pref !== 'veg' || f.food_type === 'veg');
    const q = query.trim().toLowerCase();
    if (q) return all.filter((f) => f.name.toLowerCase().includes(q) || f.name_ml?.includes(query.trim()));
    const recent = recentNames.map((id) => all.find((f) => f.id === id)).filter((f): f is Food => !!f);
    return [...recent, ...all.filter((f) => !recentNames.includes(f.id))];
  }, [foods.data, query, recentNames, pref]);

  function save(rows: NewFoodLog[]) {
    add.mutate(rows, { onSuccess: () => router.back() });
  }

  const title = `Add to ${MEAL_LABELS[meal]?.toLowerCase() ?? 'meal'}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title }} />
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, backgroundColor: theme.surface }}>
          <Search size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search: puttu, chicken, ചായ…"
            placeholderTextColor={theme.textSecondary}
            autoFocus
            style={{ flex: 1, minHeight: 48, color: theme.text, fontFamily: Fonts.regular, fontSize: 16 }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip icon={<Zap size={14} color={theme.text} />} label="Just calories" onPress={() => setQuick(true)} />
          {yesterday.length > 0 && (
            <Chip
              icon={<Copy size={14} color={theme.text} />}
              label={`Copy yesterday (${yesterday.reduce((n, l) => n + l.kcal, 0)} kcal)`}
              onPress={() =>
                save(yesterday.map(({ food_id, name, servings: s, kcal, protein_g, carbs_g, fat_g }) => ({
                  logged_on: day, meal, food_id, name, servings: Number(s), kcal,
                  protein_g: Number(protein_g), carbs_g: Number(carbs_g), fat_g: Number(fat_g),
                })))
              }
            />
          )}
        </View>
        {add.error && <Text variant="error">{add.error.message}</Text>}
      </View>

      <FlatList
        data={list}
        keyExtractor={(f) => f.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200 }}
        ListHeaderComponent={!query && recentNames.length ? <Text variant="small" style={{ fontWeight: '700', marginBottom: 6 }}>RECENT, THEN ALL FOODS</Text> : null}
        ListEmptyComponent={
          <Text variant="muted" style={{ textAlign: 'center', marginTop: 24 }}>
            Not in the list? Use “Just calories”, or ask your gym to add it.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setPicked(item);
              setServings(1);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ width: 10, height: 10, borderRadius: 2, borderWidth: 1.5, borderColor: TYPE_DOT[item.food_type], alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: TYPE_DOT[item.food_type] }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
              <Text variant="small" numberOfLines={1}>{[item.name_ml, item.serving_label].filter(Boolean).join(' · ')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '700' }}>≈{item.kcal}</Text>
              <Text variant="small">{Number(item.protein_g)} g P</Text>
            </View>
          </Pressable>
        )}
      />

      {picked && (
        <Sheet bottom={insets.bottom}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{picked.name}</Text>
          <Text variant="muted">{picked.serving_label} each</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 6 }}>
            <Round onPress={() => setServings((s) => Math.max(0.5, s - 0.5))} label="Less"><Minus size={20} color={theme.text} /></Round>
            <Text style={{ fontSize: 32, fontWeight: '800', minWidth: 70, textAlign: 'center' }}>{servings}</Text>
            <Round onPress={() => setServings((s) => Math.min(20, s + 0.5))} label="More" filled><Plus size={20} color={theme.accentText} /></Round>
          </View>
          <Text style={{ textAlign: 'center' }} variant="muted">
            ≈ {Math.round(picked.kcal * servings)} kcal · {Math.round(Number(picked.protein_g) * servings)} g protein
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancel" variant="secondary" onPress={() => setPicked(null)} style={{ flex: 1 }} />
            <Button
              title="Add"
              loading={add.isPending}
              style={{ flex: 1 }}
              onPress={() =>
                save([{
                  logged_on: day,
                  meal,
                  food_id: picked.id,
                  name: picked.name,
                  servings,
                  kcal: Math.round(picked.kcal * servings),
                  protein_g: +(Number(picked.protein_g) * servings).toFixed(1),
                  carbs_g: +(Number(picked.carbs_g) * servings).toFixed(1),
                  fat_g: +(Number(picked.fat_g) * servings).toFixed(1),
                }])
              }
            />
          </View>
        </Sheet>
      )}

      {quick && !picked && <QuickAdd bottom={insets.bottom} onCancel={() => setQuick(false)} onSave={(r) => save([{ ...r, logged_on: day, meal, food_id: null, servings: 1, carbs_g: 0, fat_g: 0 }])} saving={add.isPending} />}
    </View>
  );
}

function QuickAdd({ bottom, onCancel, onSave, saving }: {
  bottom: number;
  onCancel: () => void;
  onSave: (r: { name: string; kcal: number; protein_g: number }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const valid = Number(kcal) > 0 && Number(kcal) <= 5000;
  return (
    <Sheet bottom={bottom}>
      <Text style={{ fontSize: 18, fontWeight: '800' }}>Just calories</Text>
      <Input label="What was it? (optional)" value={name} onChangeText={setName} placeholder="Wedding lunch" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="Calories" value={kcal} onChangeText={setKcal} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Input label="Protein g (optional)" value={protein} onChangeText={setProtein} keyboardType="number-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          title="Add"
          disabled={!valid}
          loading={saving}
          style={{ flex: 1 }}
          onPress={() => onSave({ name: name.trim() || 'Quick add', kcal: Math.round(Number(kcal)), protein_g: Number(protein) || 0 })}
        />
      </View>
    </Sheet>
  );
}

function Sheet({ bottom, children }: { bottom: number; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: Math.max(bottom, 20),
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
        backgroundColor: theme.surface,
      }}>
      {children}
    </Card>
  );
}

function Round({ children, onPress, label, filled }: { children: React.ReactNode; onPress: () => void; label: string; filled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? theme.accent : theme.surfaceMuted }}>
      {children}
    </Pressable>
  );
}

function Chip({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
      {icon}
      <Text style={{ fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
