import { parseGymCode } from '@gymos/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Loading, Screen, Text } from '@/components/ui';
import {
  myGymsKey,
  setPendingJoin,
  useMyGyms,
  usePendingGyms,
  useSetActiveGym,
  type GymMembership,
} from '@/lib/gyms';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Target of https://<host>/join/<slug> links, gymos://join/<slug>, the install
// referrer and typed gym codes.
export default function JoinGymScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = parseGymCode(params.slug ?? '');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const myGyms = useMyGyms();
  const pendingGyms = usePendingGyms();
  const setActiveGym = useSetActiveGym();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gym = useQuery({
    queryKey: ['gym-by-slug', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gyms')
        .select('name, slug, address')
        .eq('slug', slug!)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (slug && gym.isPending) return <Loading />;

  if (!slug || !gym.data) {
    return (
      <Screen>
        <Text variant="heading">Gym not found</Text>
        <Text variant="muted">Check the code or ask your gym for a new link.</Text>
        <Button title="Enter a code" variant="secondary" onPress={() => router.replace('/join')} />
      </Screen>
    );
  }

  const alreadyMember = myGyms.data?.some((m) => m.gym.slug === slug);
  const awaitingApproval = pendingGyms.data?.some((m) => m.gym.slug === slug);

  async function openGym() {
    setActiveGym(slug!);
    // Make sure the gym tabs are unlocked before navigating to them.
    await queryClient.refetchQueries({ queryKey: myGymsKey(session?.user.id) });
    router.dismissTo('/');
  }

  async function join() {
    if (!session) {
      // Finish after sign-in (PendingJoinHandler in the root layout).
      setPendingJoin(slug!);
      router.replace('/sign-in');
      return;
    }
    setError(null);
    setJoining(true);
    const { error } = await supabase.rpc('join_gym', { p_slug: slug! });
    if (error) {
      setJoining(false);
      return setError(error.message);
    }
    // Gyms with "Approve new members" on leave the membership pending.
    const key = myGymsKey(session.user.id);
    await queryClient.refetchQueries({ queryKey: key });
    const mine = queryClient.getQueryData<GymMembership[]>(key)?.find((m) => m.gym.slug === slug);
    if (mine?.status === 'active') return openGym();
    setJoining(false);
  }

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Text variant="muted">You’re invited to join</Text>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {gym.data.name}
        </Text>
        {gym.data.address && <Text variant="muted">{gym.data.address}</Text>}
      </Card>
      {error && <Text variant="error">{error}</Text>}
      {alreadyMember ? (
        <Button title={`Open ${gym.data.name}`} onPress={openGym} />
      ) : awaitingApproval ? (
        <Card>
          <Text variant="heading">Request sent ✓</Text>
          <Text variant="muted">
            {gym.data.name} approves new members. You’ll get access as soon as the front desk approves you.
          </Text>
        </Card>
      ) : (
        <Button title={session ? 'Join gym' : 'Sign in to join'} onPress={join} loading={joining} />
      )}
    </Screen>
  );
}
