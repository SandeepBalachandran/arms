import { initials } from '@gymos/shared';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAvatarUrl } from '@/lib/avatar';

// A person's photo (from its storage path), or their initials on the accent
// colour. The image is cached by path, since signed URLs change.
export function Avatar({ name, path, size }: { name: string; path: string | null | undefined; size: number }) {
  const theme = useTheme();
  const url = useAvatarUrl(path);
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (path && url.data) {
    return (
      <Image
        source={{ uri: url.data, cacheKey: path }}
        style={[box, { backgroundColor: theme.surfaceMuted }]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[box, { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: theme.accentText }}>{initials(name || 'Me')}</Text>
    </View>
  );
}
