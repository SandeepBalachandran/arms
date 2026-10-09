import { Link } from 'expo-router';

import { CheckinCard } from '@/components/checkin-card';
import { ExploreTiles, HomeHeader, MembershipProgress, TodayHero } from '@/components/home-cards';
import { HoursCard } from '@/components/hours-card';
import { Screen, SectionHeader, Text } from '@/components/ui';
import { useProfile } from '@/lib/profile';

export default function HomeScreen() {
  const profile = useProfile();

  return (
    <Screen>
      <HomeHeader />

      {profile.data && !profile.data.full_name && (
        <Link href="/profile">
          <Text variant="muted">Add your name so the front desk knows who you are →</Text>
        </Link>
      )}

      <MembershipProgress />
      <CheckinCard />

      <SectionHeader title="Today" />
      <TodayHero />

      <SectionHeader title="Explore" />
      <ExploreTiles />

      <HoursCard />
    </Screen>
  );
}
