import { groupPlanDays } from '@gymos/shared';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useBodyMetrics, useMyPlans, useWorkoutHistory } from '@/lib/workouts';

export default function WorkoutsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const plans = useMyPlans();
  const history = useWorkoutHistory();
  const metrics = useBodyMetrics();
  const [refreshing, setRefreshing] = useState(false);
  const gym = useActiveGym()?.gym;
  const latestWeight = [...(metrics.data ?? [])].reverse().find((m) => m.weight_kg !== null);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([plans.refetch(), history.refetch(), metrics.refetch()]);
    setRefreshing(false);
  }

  // The gym turned workouts off while this screen was open.
  if (gym && !gym.workouts_enabled) return <Redirect href="/" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.brand} />}>
        <Text variant="title">Workouts</Text>

        <Pressable onPress={() => router.push('/progress')} accessibilityRole="button">
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="heading">Progress</Text>
              <Text style={{ color: theme.brand, fontWeight: '600' }}>Open →</Text>
            </View>
            <Text variant="muted">
              {latestWeight ? `Latest weight ${latestWeight.weight_kg} kg · ` : 'Track your weight · '}
              {history.data?.length ?? 0} workouts logged
            </Text>
          </Card>
        </Pressable>

        {plans.data?.map((plan) => (
          <Card key={plan.id}>
            <Text variant="small">Your plan</Text>
            <Text variant="heading">{plan.name}</Text>
            {plan.description && <Text variant="muted">{plan.description}</Text>}
            {groupPlanDays(plan.workout_plan_items).map((day) => (
              <View
                key={day.label}
                style={{ borderTopWidth: 1, borderColor: theme.border, paddingTop: Spacing.two, gap: Spacing.one }}>
                <Text style={{ fontWeight: '600' }}>{day.label}</Text>
                <Text variant="small">{day.items.map((i) => i.exercises.name).join(' · ')}</Text>
                <Button
                  title={`Start ${day.label}`}
                  onPress={() => router.push({ pathname: '/workout/log', params: { planId: plan.id, day: day.label } })}
                />
              </View>
            ))}
          </Card>
        ))}
        {plans.data?.length === 0 && (
          <Text variant="muted">No plan assigned yet. Ask your trainer, or log your own workout.</Text>
        )}

        <Button title="Start an empty workout" variant="secondary" onPress={() => router.push('/workout/log')} />

        {!!history.data?.length && (
          <>
            <Text variant="heading">History</Text>
            <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
              {history.data.map((log, i) => (
                <View
                  key={log.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: Spacing.two,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: theme.border,
                  }}>
                  <View>
                    <Text>{log.day_label ?? 'Workout'}</Text>
                    <Text variant="small">
                      {new Date(log.performed_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {log.workout_plans ? ` · ${log.workout_plans.name}` : ''}
                    </Text>
                  </View>
                  <Text variant="small">
                    {log.workout_log_sets[0]?.count ?? 0} sets{log.duration_min ? ` · ${log.duration_min} min` : ''}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
