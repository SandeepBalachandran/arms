import { ACTIVITY_LABELS, GOAL_LABELS, suggestTargets, type Activity, type NutritionGoal } from '@gymos/shared';
import { Stack, useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import {
  useNutritionAccess,
  useNutritionProfile,
  useNutritionTarget,
  useSaveNutritionProfile,
  useSaveTarget,
  useToday,
} from '@/lib/nutrition';
import { useBodyMetrics, useSaveBodyMetric } from '@/lib/workouts';

// First-time setup (and later edits): consent, body details for a suggested
// target, food preference and notes. Members without a trainer also set
// their own daily target here.
export default function NutritionSetupScreen() {
  const router = useRouter();
  const access = useNutritionAccess();
  const profile = useNutritionProfile().data;
  const target = useNutritionTarget().data;
  const metrics = useBodyMetrics().data;
  const today = useToday();
  const saveProfile = useSaveNutritionProfile();
  const saveTarget = useSaveTarget();
  const saveWeight = useSaveBodyMetric();
  const lastWeight = [...(metrics ?? [])].reverse().find((m) => m.weight_kg !== null)?.weight_kg ?? null;

  const [height, setHeight] = useState(profile?.height_cm ? String(Number(profile.height_cm)) : '');
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [weight, setWeight] = useState(lastWeight ? String(lastWeight) : '');
  const [sex, setSex] = useState<'male' | 'female' | null>((profile?.sex as 'male' | 'female' | null) ?? null);
  const [activity, setActivity] = useState<Activity>((profile?.activity as Activity) ?? 'moderate');
  const [pref, setPref] = useState<'veg' | 'egg' | 'nonveg' | null>(profile?.food_pref ?? null);
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [goal, setGoal] = useState<NutritionGoal>(target?.goal ?? 'maintain');
  const [error, setError] = useState<string>();

  const selfCoached = !access.trainer;
  const h = Number(height), y = Number(birthYear), w = Number(weight);
  const age = y ? new Date().getFullYear() - y : 0;
  const canSuggest = h >= 100 && h <= 250 && age >= 12 && age <= 100 && w >= 20 && w <= 400 && !!sex;
  const suggestion = canSuggest ? suggestTargets({ weightKg: w, heightCm: h, age, sex: sex!, activity, goal }) : null;
  const saving = saveProfile.isPending || saveTarget.isPending || saveWeight.isPending;

  async function save() {
    setError(undefined);
    if (height && (h < 100 || h > 250)) return setError('Height should be in centimetres, e.g. 170.');
    if (birthYear && (y < 1920 || y > 2020)) return setError('Check the birth year, e.g. 1995.');
    if (weight && (w < 20 || w > 400)) return setError('Check the weight in kg.');
    try {
      await saveProfile.mutateAsync({
        height_cm: h || null,
        birth_year: y || null,
        sex,
        activity,
        food_pref: pref,
        notes: notes.trim() || null,
      });
      if (w && w !== lastWeight) await saveWeight.mutateAsync({ measured_on: today, weight_kg: w, body_fat_pct: null, waist_cm: null });
      if (selfCoached && suggestion) await saveTarget.mutateAsync({ goal, kcal: suggestion.kcal, protein_g: suggestion.protein_g });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save. Try again.');
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Nutrition setup' }} />
      <Card style={{ flexDirection: 'row', gap: 12 }}>
        <ShieldCheck size={22} color="#16a34a" />
        <Text variant="muted" style={{ flex: 1, fontSize: 14 }}>
          What you eat is private. Only you{access.trainer ? `, ${access.trainer}` : ''} and your gym&apos;s owner can see it. Not medical advice.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="number-pad" placeholder="170" /></View>
        <View style={{ flex: 1 }}><Input label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="70" /></View>
        <View style={{ flex: 1 }}><Input label="Birth year" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" placeholder="1995" /></View>
      </View>

      <Segmented label="Sex" value={sex} onChange={setSex} options={[['male', 'Male'], ['female', 'Female']]} />
      <Segmented label="Food" value={pref} onChange={setPref} options={[['veg', 'Veg'], ['egg', 'Egg'], ['nonveg', 'Non-veg']]} />
      <Segmented
        label="Workouts"
        value={activity}
        onChange={(v) => setActivity(v ?? 'moderate')}
        options={(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => [a, ACTIVITY_LABELS[a].split(' (')[0]])}
      />
      <Input
        label="Allergies or health conditions (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. lactose intolerant, diabetic"
        multiline
      />

      {selfCoached && (
        <Card style={{ gap: 10 }}>
          <Segmented label="Your goal" value={goal} onChange={(v) => setGoal(v ?? 'maintain')} options={(Object.keys(GOAL_LABELS) as NutritionGoal[]).map((g) => [g, GOAL_LABELS[g]])} />
          <Text variant="muted">
            {suggestion
              ? `Daily target: about ${suggestion.kcal} kcal and ${suggestion.protein_g} g protein.`
              : 'Fill in height, weight, birth year and sex to get a daily target.'}
          </Text>
        </Card>
      )}

      {error && <Text variant="error">{error}</Text>}
      <Button title={profile?.consent_at ? 'Save' : 'Start tracking'} onPress={save} loading={saving} />
    </Screen>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T | null;
  onChange: (v: T | null) => void;
  options: [T, string][];
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small">{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 999, backgroundColor: theme.surfaceMuted }} accessibilityRole="radiogroup">
        {options.map(([v, text]) => {
          const selected = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => onChange(v)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: selected ? theme.hero : 'transparent' }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: selected ? theme.heroText : theme.textSecondary }}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
