import { dayKey, formatDay, formatTime, hasStarted, todayIn } from '@gymos/shared';
import { Link } from 'expo-router';

import { Card, Text } from '@/components/ui';
import { useSchedule } from '@/lib/classes';
import { useActiveGym } from '@/lib/gyms';

// The member's next booked class (Home), when the gym runs classes.
export function NextClassCard() {
  const gym = useActiveGym()?.gym;
  const schedule = useSchedule();
  if (!gym?.classes_enabled || !schedule.data) return null;

  const next = schedule.data.find(
    (c) => c.status === 'scheduled' && c.my_status === 'booked' && !hasStarted(c.starts_at),
  );
  const day = next && dayKey(next.starts_at, gym.timezone);

  return (
    <Link href="/classes">
      <Card style={{ width: '100%' }}>
        <Text variant="small">Next class</Text>
        {next ? (
          <>
            <Text variant="heading">{next.class_name}</Text>
            <Text variant="muted">
              {day === todayIn(gym.timezone) ? 'Today' : formatDay(day!)} · {formatTime(next.starts_at, gym.timezone)}
              {next.trainer_name ? ` · ${next.trainer_name}` : ''}
            </Text>
          </>
        ) : (
          <Text variant="muted">Nothing booked. See this week’s classes →</Text>
        )}
      </Card>
    </Link>
  );
}
