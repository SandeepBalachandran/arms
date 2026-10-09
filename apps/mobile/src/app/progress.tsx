import { formatDate, todayIn } from '@gymos/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { z } from 'zod';

import { LineChart } from '@/components/line-chart';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useBodyMetrics, usePersonalRecords, useSaveBodyMetric } from '@/lib/workouts';

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), `${label} looks off`);

const metricSchema = z.object({
  weight_kg: optionalNumber(20, 400, 'Weight'),
  body_fat_pct: optionalNumber(2, 70, 'Body fat'),
  waist_cm: optionalNumber(30, 250, 'Waist'),
});

export default function ProgressScreen() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const metrics = useBodyMetrics();
  const records = usePersonalRecords();
  const save = useSaveBodyMetric();
  const [form, setForm] = useState({ weight_kg: '', body_fat_pct: '', waist_cm: '' });
  const [error, setError] = useState<string | null>(null);

  const weights = (metrics.data ?? [])
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ day: m.measured_on, value: m.weight_kg! }));

  function submit() {
    const parsed = metricSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (Object.values(parsed.data).every((v) => v === null)) return setError('Enter at least one measurement');
    setError(null);
    save.mutate(
      { measured_on: todayIn(gym?.timezone ?? 'Asia/Kolkata'), ...parsed.data },
      { onSuccess: () => setForm({ weight_kg: '', body_fat_pct: '', waist_cm: '' }) },
    );
  }

  return (
    <Screen>
      <Card>
        <Text variant="heading">Body weight</Text>
        {weights.length > 0 ? (
          <LineChart points={weights} unit="kg" />
        ) : (
          <Text variant="muted">Log your weight below to start the chart.</Text>
        )}
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <Text variant="heading">Log today</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <View style={{ flex: 1 }}>
            <Input label="Weight (kg)" value={form.weight_kg} onChangeText={(weight_kg) => setForm((f) => ({ ...f, weight_kg }))} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Body fat %" value={form.body_fat_pct} onChangeText={(body_fat_pct) => setForm((f) => ({ ...f, body_fat_pct }))} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Waist (cm)" value={form.waist_cm} onChangeText={(waist_cm) => setForm((f) => ({ ...f, waist_cm }))} keyboardType="decimal-pad" />
          </View>
        </View>
        {(error || save.error) && <Text variant="error">{error ?? save.error?.message}</Text>}
        <Button title="Save" onPress={submit} loading={save.isPending} />
        <Text variant="small">Saving again today replaces today’s entry.</Text>
      </Card>

      {!!records.data?.length && (
        <Card style={{ gap: 0 }}>
          <Text variant="heading" style={{ marginBottom: Spacing.one }}>Personal bests</Text>
          {records.data.map((r, i) => (
            <View
              key={r.name}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two, borderTopWidth: i ? 1 : 0, borderColor: theme.border }}>
              <Text>{r.name}</Text>
              <Text variant="muted">
                {r.weight} kg × {r.reps}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {!!metrics.data?.length && (
        <Card style={{ gap: 0 }}>
          <Text variant="heading" style={{ marginBottom: Spacing.one }}>Measurements</Text>
          {[...metrics.data].reverse().map((m, i) => (
            <View
              key={m.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two, borderTopWidth: i ? 1 : 0, borderColor: theme.border }}>
              <Text variant="muted">{formatDate(m.measured_on)}</Text>
              <Text>
                {[
                  m.weight_kg !== null && `${m.weight_kg} kg`,
                  m.body_fat_pct !== null && `${m.body_fat_pct}%`,
                  m.waist_cm !== null && `${m.waist_cm} cm`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
