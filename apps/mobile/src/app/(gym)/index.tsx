import { Link } from 'expo-router';

import { ActivityCard } from '@/components/activity-card';
import { CheckinCard } from '@/components/checkin-card';
import { ExploreTiles, HomeHeader, MembershipProgress, TodayHero } from '@/components/home-cards';
import { HoursCard } from '@/components/hours-card';
import { InstallBanner } from '@/components/install-banner';
import { Appear } from '@/components/motion';
import { Screen, Text } from '@/components/ui';
import { useProfile } from '@/lib/profile';

export default function HomeScreen() {
  const profile = useProfile();

  return (
    <Screen>
      <Appear index={0}>
        <HomeHeader />
      </Appear>

      <InstallBanner />

      {profile.data && !profile.data.full_name && (
        <Link href="/profile">
          <Text variant="muted">Add your name so the front desk knows who you are →</Text>
        </Link>
      )}

      <Appear index={1}>
        <MembershipProgress />
      </Appear>
      <Appear index={2}>
        <CheckinCard />
      </Appear>
      <Appear index={3}>
        <TodayHero />
      </Appear>

      <Appear index={4}>
        <ExploreTiles />
      </Appear>

      <Appear index={5}>
        <ActivityCard />
      </Appear>

      <Appear index={6}>
        <HoursCard />
      </Appear>
    </Screen>
  );
}
