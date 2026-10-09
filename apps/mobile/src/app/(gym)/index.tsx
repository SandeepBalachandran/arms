import { Link } from 'expo-router';

import { CheckinCard } from '@/components/checkin-card';
import { MembershipCard } from '@/components/membership-card';
import { Screen, Text } from '@/components/ui';
import { useActiveGym } from '@/lib/gyms';
import { useProfile } from '@/lib/profile';

export default function HomeScreen() {
  const membership = useActiveGym();
  const profile = useProfile();
  const firstName = profile.data?.full_name.split(' ')[0];

  return (
    <Screen>
      <Text variant="muted">{membership?.gym.name}</Text>
      <Text variant="title">Hi {firstName || 'there'} 👋</Text>

      {profile.data && !profile.data.full_name && (
        <Link href="/profile">
          <Text variant="muted">Add your name so the front desk knows who you are →</Text>
        </Link>
      )}

      <CheckinCard />
      <MembershipCard />
    </Screen>
  );
}
