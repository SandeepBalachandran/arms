import { STAFF_ROLES } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym, useMyGyms, useSetActiveGym } from '@/lib/gyms';
import { profileKey, useProfile } from '@/lib/profile';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z.string().trim().max(20).transform((v) => v || null),
});

export default function ProfileScreen() {
  const { session } = useSession();
  const profile = useProfile();
  const router = useRouter();
  const active = useActiveGym();
  const canScan = !!active?.gym.checkin_enabled && STAFF_ROLES.includes(active.role);

  return (
    <Screen>
      <Text variant="title">Profile</Text>
      <Text variant="muted">{session?.user.email}</Text>

      {profile.data && (
        <ProfileForm key={session?.user.id} fullName={profile.data.full_name} phone={profile.data.phone ?? ''} />
      )}

      {canScan && <Button title="Front desk: scan check-ins" onPress={() => router.push('/staff/scan')} />}
      <GymSwitcher />
      <Button title="Join another gym" variant="secondary" onPress={() => router.push('/join')} />
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ full_name: fullName, phone });
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) return setStatus({ error: parsed.error.issues[0].message });
    setSaving(true);
    const { error } = await supabase.from('profiles').update(parsed.data).eq('id', session!.user.id);
    setSaving(false);
    if (error) return setStatus({ error: error.message });
    setStatus({ saved: true });
    queryClient.invalidateQueries({ queryKey: profileKey(session?.user.id) });
  }

  return (
    <Card style={{ gap: 12 }}>
      <Input
        label="Full name"
        value={values.full_name}
        onChangeText={(full_name) => setValues((v) => ({ ...v, full_name }))}
        autoComplete="name"
      />
      <Input
        label="Phone"
        value={values.phone}
        onChangeText={(phone) => setValues((v) => ({ ...v, phone }))}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      {status.error && <Text variant="error">{status.error}</Text>}
      {status.saved && <Text variant="small">Saved.</Text>}
      <Button title="Save" onPress={save} loading={saving} />
    </Card>
  );
}

function GymSwitcher() {
  const theme = useTheme();
  const { data: gyms } = useMyGyms();
  const active = useActiveGym();
  const setActive = useSetActiveGym();
  if (!gyms || gyms.length < 2) return null;

  return (
    <Card>
      <Text variant="heading">Your gyms</Text>
      {gyms.map(({ gym, role }) => {
        const selected = gym.slug === active?.gym.slug;
        return (
          <Pressable key={gym.id} onPress={() => setActive(gym.slug)} accessibilityState={{ selected }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={selected ? { color: theme.brand, fontWeight: '600' } : undefined}>{gym.name}</Text>
              <Text variant="small">{role}</Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
