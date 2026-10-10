import { addDays, nutritionAvailable, todayIn, type Food, type MealSlot, type NutritionGoal } from '@gymos/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveGym } from '@/lib/gyms';
import { useMyPt } from '@/lib/pt';
import { supabase } from '@/lib/supabase';

// Nutrition for the signed-in member: food logs, water, targets, profile and
// the trainer's comments. Shown only when nutritionAvailable() says so.

export function useNutritionAccess() {
  const gym = useActiveGym()?.gym;
  const pt = useMyPt();
  const activePt = (pt.data ?? []).filter((s) => s.state.kind === 'active' || s.state.kind === 'upcoming');
  const trainer = activePt.find((s) => s.trainer_name)?.trainer_name ?? null;
  return {
    available: nutritionAvailable(gym, activePt.length > 0),
    trainer,
    isPending: !!gym?.nutrition_enabled && !!gym.pt_enabled && pt.isPending,
  };
}

export function useToday() {
  const gym = useActiveGym()?.gym;
  return todayIn(gym?.timezone ?? 'Asia/Kolkata');
}

// Built-in foods plus the gym's own; changes rarely.
export function useFoods() {
  const gymId = useActiveGym()?.gym.id;
  return useQuery({
    queryKey: ['foods', gymId],
    enabled: !!gymId,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .or(`gym_id.is.null,gym_id.eq.${gymId}`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

// The last `days` days of the member's food log (today included).
export function useFoodLogs(days = 7) {
  const membership = useActiveGym();
  const today = useToday();
  const from = addDays(today, -(days - 1));
  return useQuery({
    queryKey: ['food-logs', membership?.memberId, from],
    enabled: !!membership,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('member_id', membership!.memberId)
        .gte('logged_on', from)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export type NewFoodLog = {
  logged_on: string;
  meal: MealSlot;
  food_id: string | null;
  name: string;
  servings: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function useAddFoodLogs() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: NewFoodLog[]) => {
      const { error } = await supabase
        .from('food_logs')
        .insert(rows.map((r) => ({ ...r, gym_id: membership!.gym.id, member_id: membership!.memberId })));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['food-logs'] }),
  });
}

export function useDeleteFoodLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('food_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['food-logs'] }),
  });
}

export function useWater(day: string) {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['water', memberId, day],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('glasses')
        .eq('member_id', memberId!)
        .eq('logged_on', day)
        .maybeSingle();
      if (error) throw error;
      return data?.glasses ?? 0;
    },
  });
}

export function useSetWater() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, glasses }: { day: string; glasses: number }) => {
      const { error } = await supabase.from('water_logs').upsert({
        member_id: membership!.memberId,
        gym_id: membership!.gym.id,
        logged_on: day,
        glasses: Math.max(0, Math.min(30, glasses)),
      });
      if (error) throw error;
    },
    onMutate: ({ day, glasses }) => queryClient.setQueryData(['water', membership?.memberId, day], glasses),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['water'] }),
  });
}

export function useNutritionTarget() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['nutrition-target', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase.from('nutrition_targets').select('*').eq('member_id', memberId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveTarget() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (t: { goal: NutritionGoal; kcal: number; protein_g: number }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('nutrition_targets').upsert({
        ...t,
        member_id: membership!.memberId,
        gym_id: membership!.gym.id,
        set_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nutrition-target'] }),
  });
}

export function useNutritionProfile() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['nutrition-profile', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase.from('nutrition_profiles').select('*').eq('member_id', memberId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type ProfileInput = {
  height_cm: number | null;
  birth_year: number | null;
  sex: 'male' | 'female' | null;
  activity: 'light' | 'moderate' | 'active';
  food_pref: 'veg' | 'egg' | 'nonveg' | null;
  notes: string | null;
};

export function useSaveNutritionProfile() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: ProfileInput) => {
      const { error } = await supabase.from('nutrition_profiles').upsert({
        ...p,
        member_id: membership!.memberId,
        gym_id: membership!.gym.id,
        consent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nutrition-profile'] }),
  });
}

export function useNutritionComments() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['nutrition-comments', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nutrition_comments')
        .select('id, day, body, created_at')
        .eq('member_id', memberId!)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
}
