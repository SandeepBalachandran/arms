import { useRouter } from 'expo-router';
import { Check, ChevronDown, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym, useMyGyms, useSetActiveGym, type GymMembership } from '@/lib/gyms';

export function GymLogo({ gym, size = 28 }: { gym: GymMembership['gym']; size?: number }) {
  const theme = useTheme();
  const radius = size * 0.3;
  if (gym.logo_url) {
    return <Image source={{ uri: gym.logo_url }} style={{ width: size, height: size, borderRadius: radius }} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: theme.hero, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.45, fontWeight: '800', color: theme.accent }}>{gym.name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

// The gym the app is showing, at the top of Home. With more than one gym it
// opens a sheet to switch; with one, it offers joining another.
export function GymBadge() {
  const theme = useTheme();
  const active = useActiveGym();
  const { data: gyms } = useMyGyms();
  const [open, setOpen] = useState(false);
  if (!active) return null;
  const many = (gyms?.length ?? 0) > 1;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={many ? `${active.gym.name}. Switch gym` : `${active.gym.name}. Gym options`}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 4,
          paddingRight: 12,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: theme.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        })}>
        <GymLogo gym={active.gym} />
        <Text style={{ fontWeight: '700', fontSize: 14, maxWidth: 220 }} numberOfLines={1}>{active.gym.name}</Text>
        <ChevronDown size={16} color={theme.textSecondary} />
      </Pressable>
      <GymSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function GymSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const active = useActiveGym();
  const { data: gyms } = useMyGyms();
  const setActive = useSetActiveGym();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: theme.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 20,
          paddingBottom: Math.max(insets.bottom, 20),
          gap: 6,
        }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 10 }} />
        <Text variant="heading">Your gyms</Text>
        <Text variant="small" style={{ marginBottom: 8 }}>The app shows one gym at a time. Pick which.</Text>
        {gyms?.map(({ gym, role }) => {
          const selected = gym.slug === active?.gym.slug;
          return (
            <Pressable
              key={gym.id}
              onPress={() => {
                setActive(gym.slug);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: selected ? theme.brand : theme.border,
                backgroundColor: selected ? theme.tints.green.bg : theme.surface,
                opacity: pressed ? 0.7 : 1,
              })}>
              <GymLogo gym={gym} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }} numberOfLines={1}>{gym.name}</Text>
                <Text variant="small" style={{ textTransform: 'capitalize' }}>{role}</Text>
              </View>
              {selected && <Check size={20} color={theme.brand} />}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            onClose();
            router.push('/join');
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color={theme.text} />
          </View>
          <Text style={{ fontWeight: '600' }}>Join another gym</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
