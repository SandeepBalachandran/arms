import { addDays, todayIn } from '@gymos/shared';

import { useMyVisits } from '@/lib/checkins';
import { useActiveGym } from '@/lib/gyms';
import { useMyPt } from '@/lib/pt';
import { useWorkoutHistory } from '@/lib/workouts';

export type ActivityDay = { day: string; label: string; count: number; isToday: boolean; isFuture: boolean };

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Active days from everything the gym tracks: check-ins, logged workouts and
// PT sessions. `available` is false when the gym tracks none of them.
export function useActivity() {
  const gym = useActiveGym()?.gym;
  const visits = useMyVisits();
  const workouts = useWorkoutHistory();
  const pt = useMyPt();
  const tz = gym?.timezone ?? 'Asia/Kolkata';
  const today = todayIn(tz);

  const perDay = new Map<string, number>();
  const add = (day: string) => perDay.set(day, (perDay.get(day) ?? 0) + 1);
  if (gym?.checkin_enabled) visits.data?.forEach((v) => add(todayIn(tz, new Date(v.checked_in_at))));
  if (gym?.workouts_enabled) workouts.data?.forEach((w) => add(todayIn(tz, new Date(w.performed_at))));
  if (gym?.pt_enabled) pt.data?.forEach((s) => s.sessions.forEach((x) => add(x.session_on)));

  // This week, Monday first.
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, dow === 0 ? -6 : 1 - dow);
  const week: ActivityDay[] = LABELS.map((label, i) => {
    const day = addDays(monday, i);
    return { day, label, count: perDay.get(day) ?? 0, isToday: day === today, isFuture: day > today };
  });

  // Consecutive active days ending today (or yesterday, so the streak isn't
  // "broken" before the member has been in today).
  let streak = 0;
  let cursor = perDay.has(today) ? today : addDays(today, -1);
  while (perDay.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const month = today.slice(0, 7);
  return {
    available: !!gym && (gym.checkin_enabled || gym.workouts_enabled || gym.pt_enabled),
    week,
    weekDays: week.filter((d) => d.count > 0).length,
    monthDays: [...perDay.keys()].filter((d) => d.startsWith(month)).length,
    streak,
  };
}
