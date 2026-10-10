import { addDays, calorieBalance, dayTotals, MEAL_LABELS, MEALS, onTarget, type MealSlot } from '@gymos/shared';
import { Redirect, useRouter } from 'expo-router';
import { Droplets, MessageCircle, Minus, Plus, Salad, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Appear, GrowBar, GrowFill } from '@/components/motion';
import { ProgressRing } from '@/components/progress-ring';
import { Button, Card, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import {
  useDeleteFoodLog,
  useFoodLogs,
  useNutritionAccess,
  useNutritionComments,
  useNutritionProfile,
  useNutritionTarget,
  useSetWater,
  useToday,
  useWater,
} from '@/lib/nutrition';

const WATER_GOAL = 8;

export default function FoodScreen() {
  const theme = useTheme();
  const router = useRouter();
  const access = useNutritionAccess();
  const today = useToday();
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const date = day === 'today' ? today : addDays(today, -1);
  const profile = useNutritionProfile();
  const target = useNutritionTarget();
  const logs = useFoodLogs(7);
  const comments = useNutritionComments();

  if (access.isPending) return <Loading />;
  // The gym turned nutrition off, or the PT package ended.
  if (!access.available) return <Redirect href="/" />;
  if (profile.isPending || target.isPending || logs.isPending) return <Loading />;

  if (!profile.data?.consent_at) {
    return (
      <Screen>
        <Text variant="title">Food</Text>
        <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, padding: 22, gap: 10 }}>
          <Salad size={40} color={theme.accent} />
          <Text style={{ color: theme.heroText, fontSize: 22, fontWeight: '800' }}>Track what you eat</Text>
          <Text style={{ color: theme.heroMuted }}>
            Log your meals from a list of Kerala and Indian foods.{' '}
            {access.trainer ? `${access.trainer} sees your log and sets your daily calories and protein.` : 'See your calories and protein against a daily target.'}
          </Text>
          <Button title="Get started" onPress={() => router.push('/food/setup')} />
        </Card>
      </Screen>
    );
  }

  const all = logs.data ?? [];
  const items = all.filter((l) => l.logged_on === date);
  const totals = dayTotals(items);
  const t = target.data;
  const latest = comments.data?.[0];

  return (
    <Screen>
      <Appear index={0} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="title">Food</Text>
          <Text variant="muted">{access.trainer ? `Coached by ${access.trainer}` : 'Your daily targets'}</Text>
        </View>
        <DayToggle value={day} onChange={setDay} />
      </Appear>

      <Appear index={1}>
        {t ? (
          <Summary eaten={totals} target={t} />
        ) : (
          <Card style={{ gap: 8 }}>
            <Text variant="heading">{access.trainer ? `Waiting for ${access.trainer}` : 'Set your daily target'}</Text>
            <Text variant="muted">
              {access.trainer
                ? 'Your trainer will set your daily calories and protein. Start logging meanwhile.'
                : 'We suggest one from your details. You can change it any time.'}
            </Text>
            {!access.trainer && <Button title="Set target" onPress={() => router.push('/food/setup')} />}
          </Card>
        )}
      </Appear>

      {latest && (
        <Appear index={2}>
          <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: theme.tints.blue.bg, borderColor: theme.tints.blue.bg }}>
            <MessageCircle size={20} color={theme.tints.blue.fg} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '600' }}>{latest.body}</Text>
              <Text variant="small">{access.trainer ?? 'Your coach'}</Text>
            </View>
          </Card>
        </Appear>
      )}

      <Appear index={3}>
        <WaterRow day={date} />
      </Appear>

      {MEALS.map((meal, i) => (
        <Appear key={meal} index={4 + i}>
          <MealCard meal={meal} day={date} items={items.filter((l) => l.meal === meal)} />
        </Appear>
      ))}

      {t && (
        <Appear index={10} style={{ gap: 12 }}>
          <SectionHeader title="Last 7 days" />
          <WeekChart logs={all} today={today} target={t.kcal} />
        </Appear>
      )}

      <Text variant="small" style={{ textAlign: 'center', marginBottom: 12 }}>
        Calories are estimates. Not medical advice.
      </Text>
    </Screen>
  );
}

function DayToggle({ value, onChange }: { value: 'today' | 'yesterday'; onChange: (v: 'today' | 'yesterday') => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: theme.surfaceMuted }}>
      {(['yesterday', 'today'] as const).map((d) => (
        <Pressable
          key={d}
          onPress={() => onChange(d)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === d }}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: value === d ? theme.hero : 'transparent' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: value === d ? theme.heroText : theme.textSecondary }}>
            {d === 'today' ? 'Today' : 'Yesterday'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Calories ring + protein bar on the dark card.
function Summary({ eaten, target }: { eaten: ReturnType<typeof dayTotals>; target: { kcal: number; protein_g: number } }) {
  const theme = useTheme();
  const balance = calorieBalance(eaten.kcal, target.kcal);
  const proteinPct = Math.min(1, eaten.protein_g / target.protein_g);
  return (
    <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, padding: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <ProgressRing value={eaten.kcal / target.kcal} label={String(eaten.kcal)} size={104} warn={balance.over && balance.diff > target.kcal * 0.1} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.heroMuted, fontSize: 13 }}>Calories · target {target.kcal}</Text>
          <Text style={{ color: balance.over ? '#fbbf24' : theme.accent, fontSize: 24, fontWeight: '800' }}>{balance.label}</Text>
          <Text style={{ color: theme.heroMuted, fontSize: 12 }}>
            Carbs {Math.round(eaten.carbs_g)} g · Fat {Math.round(eaten.fat_g)} g
          </Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.heroText, fontWeight: '700' }}>Protein</Text>
          <Text style={{ color: theme.heroMuted }}>
            {Math.round(eaten.protein_g)} / {target.protein_g} g
          </Text>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
          <GrowFill fraction={proteinPct} style={{ height: '100%', borderRadius: 5, backgroundColor: theme.accent }} />
        </View>
      </View>
    </Card>
  );
}

function WaterRow({ day }: { day: string }) {
  const theme = useTheme();
  const water = useWater(day);
  const setWater = useSetWater();
  const glasses = water.data ?? 0;
  const tint = theme.tints.blue;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Droplets size={20} color={tint.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700' }}>Water</Text>
        <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }} accessible accessibilityLabel={`${glasses} of ${WATER_GOAL} glasses`}>
          {Array.from({ length: WATER_GOAL }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < glasses ? tint.fg : theme.surfaceMuted }} />
          ))}
        </View>
      </View>
      <Pressable
        onPress={() => setWater.mutate({ day, glasses: glasses - 1 })}
        disabled={glasses === 0}
        accessibilityLabel="One glass less"
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', opacity: glasses ? 1 : 0.4 }}>
        <Minus size={16} color={theme.text} />
      </Pressable>
      <Text style={{ fontWeight: '800', minWidth: 20, textAlign: 'center' }}>{glasses}</Text>
      <Pressable
        onPress={() => setWater.mutate({ day, glasses: glasses + 1 })}
        accessibilityLabel="One more glass"
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tint.fg, alignItems: 'center', justifyContent: 'center' }}>
        <Plus size={16} color="#ffffff" />
      </Pressable>
    </Card>
  );
}

type Log = NonNullable<ReturnType<typeof useFoodLogs>['data']>[number];

function MealCard({ meal, day, items }: { meal: MealSlot; day: string; items: Log[] }) {
  const theme = useTheme();
  const router = useRouter();
  const remove = useDeleteFoodLog();
  const kcal = items.reduce((n, l) => n + l.kcal, 0);

  async function onRemove(l: Log) {
    if (await confirm({ title: `Remove ${l.name}?`, message: `${l.kcal} kcal from ${MEAL_LABELS[meal].toLowerCase()}`, confirmText: 'Remove' })) {
      remove.mutate(l.id);
    }
  }

  return (
    <Card style={{ gap: items.length ? 8 : 0, paddingVertical: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{MEAL_LABELS[meal]}</Text>
          {items.length > 0 && <Text variant="small">{kcal} kcal</Text>}
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/food/add', params: { meal, day } })}
          accessibilityRole="button"
          accessibilityLabel={`Add to ${MEAL_LABELS[meal]}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 })}>
          <Plus size={16} color={theme.accentText} />
          <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 13 }}>Add</Text>
        </Pressable>
      </View>
      {items.map((l) => (
        <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: theme.border, paddingTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1}>{l.name}{Number(l.servings) !== 1 ? ` ×${Number(l.servings)}` : ''}</Text>
            <Text variant="small">{Math.round(Number(l.protein_g))} g protein</Text>
          </View>
          <Text style={{ fontWeight: '700' }}>{l.kcal}</Text>
          <Pressable onPress={() => onRemove(l)} hitSlop={8} accessibilityLabel={`Remove ${l.name}`}>
            <X size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

// Seven bars of calories eaten, with the target as a line: lime on target,
// amber over, blue under.
function WeekChart({ logs, today, target }: { logs: Log[]; today: string; target: number }) {
  const theme = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const totals = days.map((d) => dayTotals(logs.filter((l) => l.logged_on === d)).kcal);
  const max = Math.max(target * 1.3, ...totals);
  const H = 120;
  const hit = totals.filter((k) => onTarget(k, target)).length;
  const logged = totals.filter((k) => k > 0).length;

  return (
    <Card style={{ gap: 12 }}>
      <Text variant="muted">
        {logged ? `On target ${hit} of ${logged} logged days` : 'Log meals to see your week'}
      </Text>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: (target / max) * H, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.textSecondary }} />
        {totals.map((k, i) => {
          const color = !k ? theme.surfaceMuted : onTarget(k, target) ? theme.chart : k > target ? '#f59e0b' : theme.tints.blue.fg;
          return (
            <View key={days[i]} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <GrowBar height={Math.max(6, (k / max) * H)} delay={i * 60} style={{ borderRadius: 8, backgroundColor: color }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {days.map((d) => (
          <Text key={d} variant="small" style={{ flex: 1, textAlign: 'center', fontWeight: d === today ? '800' : '400' }}>
            {new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'narrow', timeZone: 'UTC' })}
          </Text>
        ))}
      </View>
    </Card>
  );
}
