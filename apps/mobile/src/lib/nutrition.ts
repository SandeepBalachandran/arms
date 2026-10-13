import {
  addDays,
  DEFAULT_WATER_CONTAINERS,
  DEFAULT_WATER_GOAL_ML,
  MAX_WATER_ML,
  nutritionAvailable,
  parseWaterContainers,
  todayIn,
  type Food,
  type MealSlot,
  type NutritionGoal,
  type WaterContainer,
} from '@gymos/shared';
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
  const coached = activePt.find((s) => s.trainer_name);
  return {
    available: nutritionAvailable(gym, activePt.length > 0),
    trainer: coached?.trainer_name ?? null,
    trainerAvatar: coached?.trainer_avatar ?? null,
    isPending: !!gym?.nutrition_enabled && !!gym.pt_enabled && pt.isPending,
  };
}

export function useToday() {
  const gym = useActiveGym()?.gym;
  return todayIn(gym?.timezone ?? 'Asia/Kolkata');
}

// Built-in foods plus the gym's own; changes rarely.
// Built-in foods, the gym's list and the member's own foods ("My foods").
// Coaches can also read their clients' foods, so ask for our own explicitly.
export function useFoods() {
  const membership = useActiveGym();
  const gymId = membership?.gym.id;
  const memberId = membership?.memberId;
  return useQuery({
    queryKey: ['foods', gymId, memberId],
    enabled: !!gymId && !!memberId,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .or(`gym_id.is.null,and(gym_id.eq.${gymId},member_id.is.null),member_id.eq.${memberId}`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export type MyFoodInput = {
  name: string;
  serving_label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  food_type: Food['food_type'];
};

// Adds or edits one of the member's own foods; returns the saved food.
export function useSaveMyFood() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...food }: MyFoodInput & { id?: string }): Promise<Food> => {
      const row = { ...food, gym_id: membership!.gym.id, member_id: membership!.memberId, category: 'other' };
      const query = id ? supabase.from('foods').update(row).eq('id', id) : supabase.from('foods').insert(row);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foods'] }),
  });
}

// Logged meals keep their name and calories; they just lose the link.
export function useDeleteMyFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foods'] }),
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

// Millilitres drunk on a day.
export function useWater(day: string) {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['water', memberId, day],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('ml')
        .eq('member_id', memberId!)
        .eq('logged_on', day)
        .maybeSingle();
      if (error) throw error;
      return data?.ml ?? 0;
    },
  });
}

export function useSetWater() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, ml }: { day: string; ml: number }) => {
      const { error } = await supabase.from('water_logs').upsert({
        member_id: membership!.memberId,
        gym_id: membership!.gym.id,
        logged_on: day,
        ml: Math.max(0, Math.min(MAX_WATER_ML, Math.round(ml))),
      });
      if (error) throw error;
    },
    onMutate: ({ day, ml }) => queryClient.setQueryData(['water', membership?.memberId, day], ml),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['water'] }),
  });
}

// The member's daily goal and containers, or the defaults.
export function useWaterSettings() {
  const memberId = useActiveGym()?.memberId;
  return useQuery({
    queryKey: ['water-settings', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_settings')
        .select('goal_ml, containers')
        .eq('member_id', memberId!)
        .maybeSingle();
      if (error) throw error;
      return {
        goalMl: data?.goal_ml ?? DEFAULT_WATER_GOAL_ML,
        containers: parseWaterContainers(data?.containers) ?? DEFAULT_WATER_CONTAINERS,
      };
    },
  });
}

export function useSaveWaterSettings() {
  const membership = useActiveGym();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalMl, containers }: { goalMl: number; containers: WaterContainer[] }) => {
      const valid = parseWaterContainers(containers);
      if (!valid) throw new Error('Each container needs a name and a size between 50 and 3000 ml.');
      const { error } = await supabase.from('water_settings').upsert({
        member_id: membership!.memberId,
        gym_id: membership!.gym.id,
        goal_ml: goalMl,
        containers: valid,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['water-settings'] }),
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
