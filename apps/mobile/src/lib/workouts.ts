import { estimatedOneRepMax, num, type ExerciseMeasure } from '@gymos/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveGym } from '@/lib/gyms';
import { supabase } from '@/lib/supabase';

export type ExerciseInfo = { id: string; name: string; muscle_group: string; measure: ExerciseMeasure };

// Plans the trainer assigned, with their days and exercises.
export function useMyPlans() {
  const membership = useActiveGym();
  return useQuery({
    queryKey: ['my-plans', membership?.memberId],
    enabled: !!membership?.gym.workouts_enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_assignments')
        .select(
          'id, workout_plans!inner(id, name, description, is_archived, workout_plan_items(id, day_label, position, sets, reps, rest_sec, notes, exercises(id, name, muscle_group, measure)))',
        )
        .eq('member_id', membership!.memberId)
        .eq('workout_plans.is_archived', false)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data.map((a) => a.workout_plans);
    },
  });
}

export function useExercises() {
  const gymId = useActiveGym()?.gym.id;
  return useQuery({
    queryKey: ['exercises', gymId],
    enabled: !!gymId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, measure')
        .or(`gym_id.is.null,gym_id.eq.${gymId}`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ExerciseInfo[];
    },
  });
}

export function useWorkoutHistory() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['workout-history', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_logs')
        .select('id, performed_at, day_label, duration_min, workout_plans(name), workout_log_sets(count)')
        .eq('member_id', memberId!)
        .order('performed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
}

type SetRow = { exercise_id: string; set_no: number; reps: number | null; weight_kg: number | string | null; duration_sec: number | null };

// The sets from the most recent workout that included each exercise.
export function useLastSets(exerciseIds: string[]) {
  const memberId = useActiveGym()?.memberId;
  const ids = [...exerciseIds].sort();
  return useQuery({
    queryKey: ['last-sets', memberId, ids],
    enabled: !!memberId && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_log_sets')
        .select('exercise_id, set_no, reps, weight_kg, duration_sec, workout_logs!inner(id, member_id, performed_at)')
        .eq('workout_logs.member_id', memberId!)
        .in('exercise_id', ids)
        .order('performed_at', { referencedTable: 'workout_logs', ascending: false })
        .limit(300);
      if (error) throw error;
      const latest = new Map<string, { logId: string; at: string; sets: SetRow[] }>();
      for (const row of data) {
        const current = latest.get(row.exercise_id);
        const log = row.workout_logs;
        if (!current || log.performed_at > current.at) {
          latest.set(row.exercise_id, { logId: log.id, at: log.performed_at, sets: [row] });
        } else if (current.logId === log.id) {
          current.sets.push(row);
        }
      }
      for (const entry of latest.values()) entry.sets.sort((a, b) => a.set_no - b.set_no);
      return latest;
    },
  });
}

export type DraftSet = { reps: string; weight: string; seconds: string; done: boolean };
export type DraftExercise = { exercise: ExerciseInfo; restSec: number | null; target?: string; sets: DraftSet[] };

export function useSaveWorkout() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: {
      planId: string | null;
      dayLabel: string | null;
      startedAt: number;
      exercises: DraftExercise[];
    }) => {
      const sets = draft.exercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.done)
          .map((s, i) => ({
            exercise_id: ex.exercise.id,
            set_no: i + 1,
            reps: s.reps ? Number(s.reps) : null,
            weight_kg: s.weight ? Number(s.weight.replace(',', '.')) : null,
            duration_sec: s.seconds ? Number(s.seconds) : null,
          })),
      );
      if (sets.length === 0) throw new Error('Tick at least one set as done before finishing.');

      const { data: log, error } = await supabase
        .from('workout_logs')
        .insert({
          gym_id: membership!.gym.id,
          member_id: membership!.memberId,
          plan_id: draft.planId,
          day_label: draft.dayLabel,
          performed_at: new Date(draft.startedAt).toISOString(),
          duration_min: Math.max(1, Math.round((Date.now() - draft.startedAt) / 60_000)),
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: setsError } = await supabase
        .from('workout_log_sets')
        .insert(sets.map((s) => ({ ...s, log_id: log.id })));
      if (setsError) {
        await supabase.from('workout_logs').delete().eq('id', log.id);
        throw setsError;
      }
      return log.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history'] });
      queryClient.invalidateQueries({ queryKey: ['last-sets'] });
      queryClient.invalidateQueries({ queryKey: ['personal-records'] });
    },
  });
}

// Progress -------------------------------------------------------------------------

export function useBodyMetrics() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['body-metrics', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_metrics')
        .select('id, measured_on, weight_kg, body_fat_pct, waist_cm')
        .eq('member_id', memberId!)
        .order('measured_on');
      if (error) throw error;
      return data.map((m) => ({
        ...m,
        weight_kg: num(m.weight_kg),
        body_fat_pct: num(m.body_fat_pct),
        waist_cm: num(m.waist_cm),
      }));
    },
  });
}

export function useSaveBodyMetric() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (m: { measured_on: string; weight_kg: number | null; body_fat_pct: number | null; waist_cm: number | null }) => {
      const { error } = await supabase
        .from('body_metrics')
        .upsert({ ...m, gym_id: membership!.gym.id, member_id: membership!.memberId }, { onConflict: 'member_id,measured_on' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['body-metrics'] }),
  });
}

// Best estimated one-rep max per exercise over the last year.
export function usePersonalRecords() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['personal-records', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('workout_log_sets')
        .select('reps, weight_kg, exercises!inner(id, name), workout_logs!inner(member_id, performed_at)')
        .eq('workout_logs.member_id', memberId!)
        .gte('workout_logs.performed_at', since)
        .not('weight_kg', 'is', null)
        .gt('reps', 0)
        .limit(2000);
      if (error) throw error;
      const best = new Map<string, { name: string; weight: number; reps: number; e1rm: number; at: string }>();
      for (const s of data) {
        const weight = num(s.weight_kg) ?? 0;
        const e1rm = estimatedOneRepMax(weight, s.reps ?? 0);
        const current = best.get(s.exercises.id);
        if (!current || e1rm > current.e1rm) {
          best.set(s.exercises.id, { name: s.exercises.name, weight, reps: s.reps ?? 0, e1rm, at: s.workout_logs.performed_at });
        }
      }
      return [...best.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);
    },
  });
}
