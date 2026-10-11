import { Camera, Images, Trash2, type LucideIcon } from 'lucide-react-native';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { PhotoSource } from '@/lib/avatar';

// Bottom sheet: take a photo, choose one, or remove the current one.
export function PhotoSheet({ visible, hasPhoto, onPick, onClose }: {
  visible: boolean;
  hasPhoto: boolean;
  onPick: (source: PhotoSource | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  function choose(source: PhotoSource | null) {
    onClose();
    onPick(source);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onClose} accessibilityLabel="Close" />
          <Animated.View
            entering={reduced ? undefined : SlideInDown.springify().damping(18)}
            accessibilityViewIsModal
            style={{ backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 18 + insets.bottom, gap: 6, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: '800' }}>Profile photo</Text>
            <Text variant="muted" style={{ marginBottom: 8 }}>Your gym&apos;s team sees it, so the front desk knows it&apos;s you. Other members can&apos;t.</Text>
            <Option icon={Camera} label="Take photo" onPress={() => choose('camera')} />
            <Option icon={Images} label="Choose from gallery" onPress={() => choose('library')} />
            {hasPhoto && <Option icon={Trash2} label="Remove photo" danger onPress={() => choose(null)} />}
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

function Option({ icon: Icon, label, danger, onPress }: { icon: LucideIcon; label: string; danger?: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 12, borderRadius: 16, backgroundColor: pressed ? theme.surfaceMuted : 'transparent' })}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={color} />
      </View>
      <Text style={{ fontWeight: '700', fontSize: 16, color }}>{label}</Text>
    </Pressable>
  );
}
