import { Link } from 'expo-router';

import { Card, Screen, Text } from '@/components/ui';
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

      <Card>
        <Text variant="small">Membership</Text>
        <Text variant="heading">No active plan yet</Text>
        <Text variant="muted">Plans and online payment are coming soon. Ask the front desk for now.</Text>
      </Card>
    </Screen>
  );
}
