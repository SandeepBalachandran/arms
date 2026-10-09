import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useActiveGym } from '@/lib/gyms';
import { supabase } from '@/lib/supabase';

const SCHEDULE_DAYS = 8;

// Upcoming classes (next week) with counts and the member's own booking.
export function useSchedule() {
  const gym = useActiveGym()?.gym;
  return useQuery({
    queryKey: ['schedule', gym?.id],
    enabled: !!gym?.classes_enabled,
    queryFn: async () => {
      const now = Date.now();
      const { data, error } = await supabase.rpc('class_schedule', {
        p_gym_id: gym!.id,
        // Include classes that started in the last hour so "in progress" still shows.
        p_from: new Date(now - 3_600_000).toISOString(),
        p_to: new Date(now + SCHEDULE_DAYS * 86_400_000).toISOString(),
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useBookClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('book_class', { p_session_id: sessionId });
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });
}
