import { addDays, FOOD_TYPE_LABELS, MEAL_LABELS, MEALS, type Food, type FoodType, type MealSlot } from '@gymos/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Copy, Minus, Pencil, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Input, Text } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import {
  useAddFoodLogs,
  useDeleteMyFood,
  useFoodLogs,
  useFoods,
  useNutritionProfile,
  useSaveMyFood,
  useToday,
  type MyFoodInput,
  type NewFoodLog,
} from '@/lib/nutrition';

const TYPE_DOT = { veg: '#16a34a', egg: '#d97706', nonveg: '#dc2626' } as const;

export default function AddFoodScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();
  const today = useToday();
  // Opened without them (the installed app reopening on this screen, or a
  // bookmarked link): today, and the meal for this time of day.
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  const meal: MealSlot = MEALS.includes(params.meal as MealSlot) ? (params.meal as MealSlot) : mealForNow();
  const foods = useFoods();
  const logs = useFoodLogs(7);
  const pref = useNutritionProfile().data?.food_pref;
  const add = useAddFoodLogs();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);
  // The "my own food" form: new (food undefined) or editing one of My foods.
  const [form, setForm] = useState<{ food?: Food } | null>(null);
  const saveFood = useSaveMyFood();
  const deleteFood = useDeleteMyFood();

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
    // My foods first, then recently eaten, then everything else.
    const mine = all.filter((f) => f.member_id);
    const recent = recentNames.map((id) => all.find((f) => f.id === id && !f.member_id)).filter((f): f is Food => !!f);
    const shown = new Set([...mine, ...recent].map((f) => f.id));
    return [...mine, ...recent, ...all.filter((f) => !shown.has(f.id))];
  }, [foods.data, query, recentNames, pref]);

  function save(rows: NewFoodLog[]) {
    add.mutate(rows, { onSuccess: () => router.back() });
  }

  const logRow = (food: MyFoodInput, foodId: string | null): NewFoodLog => ({
    logged_on: day,
    meal,
    food_id: foodId,
    name: food.name,
    servings: 1,
    kcal: food.kcal,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
  });

  // New food: log it, saving it to My foods first if asked.
  function addOwn(food: MyFoodInput, keep: boolean) {
    if (!keep) return save([logRow(food, null)]);
    saveFood.mutate(food, { onSuccess: (saved) => save([logRow(food, saved.id)]) });
  }

  async function removeOwn(food: Food) {
    const ok = await confirm({ title: `Delete ${food.name}?`, message: 'It leaves My foods. Meals you already logged with it stay.', confirmText: 'Delete' });
    if (ok) deleteFood.mutate(food.id, { onSuccess: () => setForm(null) });
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
          <Chip icon={<Plus size={14} color={theme.text} />} label="Add my own food" onPress={() => setForm({})} />
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
        ListHeaderComponent={
          !query && (recentNames.length || list.some((f) => f.member_id)) ? (
            <Text variant="small" style={{ fontWeight: '700', marginBottom: 6 }}>MY FOODS AND RECENT, THEN ALL FOODS</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 10, marginTop: 24 }}>
            <Text variant="muted" style={{ textAlign: 'center' }}>Not in the list? Add it once and it’s saved to My foods.</Text>
            <Chip icon={<Plus size={14} color={theme.text} />} label={query.trim() ? `Add “${query.trim()}”` : 'Add my own food'} onPress={() => setForm({})} />
          </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{item.name}</Text>
                {item.member_id && (
                  <View style={{ borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: theme.tints.green.bg }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.tints.green.fg }}>Mine</Text>
                  </View>
                )}
              </View>
              <Text variant="small" numberOfLines={1}>{[item.name_ml, item.serving_label].filter(Boolean).join(' · ')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '700' }}>≈{item.kcal}</Text>
              <Text variant="small">{Number(item.protein_g)} g P</Text>
            </View>
            {item.member_id && (
              <Pressable onPress={() => setForm({ food: item })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} style={{ padding: 4 }}>
                <Pencil size={16} color={theme.textSecondary} />
              </Pressable>
            )}
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

      {form && !picked && (
        <OwnFoodForm
          key={form.food?.id ?? 'new'}
          bottom={insets.bottom}
          food={form.food}
          initialName={form.food ? undefined : query.trim()}
          defaultType={pref ?? 'veg'}
          mealLabel={MEAL_LABELS[meal]?.toLowerCase() ?? 'meal'}
          saving={add.isPending || saveFood.isPending || deleteFood.isPending}
          error={saveFood.error?.message ?? deleteFood.error?.message}
          onCancel={() => setForm(null)}
          onAdd={addOwn}
          onUpdate={(food) => saveFood.mutate({ ...food, id: form.food!.id }, { onSuccess: () => setForm(null) })}
          onDelete={() => removeOwn(form.food!)}
        />
      )}
    </View>
  );
}

// A food the member adds themselves. New: log it (and keep it in My foods
// unless switched off). Editing one of My foods: save changes or delete it.
function OwnFoodForm({ bottom, food, initialName, defaultType, mealLabel, saving, error, onCancel, onAdd, onUpdate, onDelete }: {
  bottom: number;
  food?: Food;
  initialName?: string;
  defaultType: FoodType;
  mealLabel: string;
  saving: boolean;
  error?: string;
  onCancel: () => void;
  onAdd: (food: MyFoodInput, keep: boolean) => void;
  onUpdate: (food: MyFoodInput) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const editing = !!food;
  const [name, setName] = useState(food?.name ?? initialName ?? '');
  const [serving, setServing] = useState(food?.serving_label ?? '1 serving');
  const [kcal, setKcal] = useState(food ? String(food.kcal) : '');
  const [protein, setProtein] = useState(food ? String(Number(food.protein_g)) : '');
  const [carbs, setCarbs] = useState(food && Number(food.carbs_g) ? String(Number(food.carbs_g)) : '');
  const [fat, setFat] = useState(food && Number(food.fat_g) ? String(Number(food.fat_g)) : '');
  const [type, setType] = useState<FoodType>(food?.food_type ?? defaultType);
  const [keep, setKeep] = useState(true);

  const n = (v: string) => Number(v.replace(',', '.')) || 0;
  const named = name.trim().length >= 2;
  const valid = n(kcal) > 0 && n(kcal) <= 3000 && n(protein) <= 300 && n(carbs) <= 500 && n(fat) <= 300 && (named || (!editing && !keep));
  const value = (): MyFoodInput => ({
    name: name.trim() || 'Quick add',
    serving_label: serving.trim() || '1 serving',
    kcal: Math.round(n(kcal)),
    protein_g: +n(protein).toFixed(1),
    carbs_g: +n(carbs).toFixed(1),
    fat_g: +n(fat).toFixed(1),
    food_type: type,
  });
  const decimal = (set: (v: string) => void) => (v: string) => set(v.replace(/[^0-9.,]/g, ''));

  return (
    <Sheet bottom={bottom}>
      <Text style={{ fontSize: 18, fontWeight: '800' }}>{editing ? 'Edit my food' : 'Add my own food'}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1.5 }}><Input label="Name" value={name} onChangeText={setName} placeholder="Amma’s fish curry" maxLength={80} /></View>
        <View style={{ flex: 1 }}><Input label="Portion" value={serving} onChangeText={setServing} placeholder="1 bowl" maxLength={40} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="Calories" value={kcal} onChangeText={decimal(setKcal)} keyboardType="number-pad" placeholder="320" /></View>
        <View style={{ flex: 1 }}><Input label="Protein g" value={protein} onChangeText={decimal(setProtein)} keyboardType="decimal-pad" placeholder="0" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="Carbs g (optional)" value={carbs} onChangeText={decimal(setCarbs)} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Input label="Fat g (optional)" value={fat} onChangeText={decimal(setFat)} keyboardType="decimal-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['veg', 'egg', 'nonveg'] as const).map((t) => {
          const on = type === t;
          return (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? TYPE_DOT[t] : theme.border, backgroundColor: on ? theme.surfaceMuted : 'transparent' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: on ? TYPE_DOT[t] : theme.textSecondary }}>{FOOD_TYPE_LABELS[t]}</Text>
            </Pressable>
          );
        })}
      </View>
      {!editing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>Save to My foods</Text>
            <Text variant="small">Pick it again next time. Your trainer can see it.</Text>
          </View>
          <Switch value={keep} onValueChange={setKeep} trackColor={{ true: theme.brand, false: theme.border }} thumbColor="#ffffff" accessibilityLabel="Save to My foods" />
        </View>
      )}
      {error && <Text variant="error">{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          title={editing ? 'Save' : `Add to ${mealLabel}`}
          disabled={!valid}
          loading={saving}
          style={{ flex: 1.4 }}
          onPress={() => (editing ? onUpdate(value()) : onAdd(value(), keep))}
        />
      </View>
      {editing && (
        <Pressable onPress={onDelete} disabled={saving} accessibilityRole="button" style={{ alignSelf: 'center', padding: 6 }}>
          <Text style={{ color: theme.danger, fontWeight: '600' }}>Delete from My foods</Text>
        </Pressable>
      )}
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

function mealForNow(): MealSlot {
  const h = new Date().getHours();
  return h < 7 ? 'early' : h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner';
}
