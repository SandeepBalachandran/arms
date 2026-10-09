import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Shown while the session and gyms load. In store builds the native splash
// (same artwork, app.json) covers this; Expo Go shows this one instead.
export function SplashView() {
  const theme = useTheme();
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}
      accessibilityLabel="GymOS is loading">
      <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 240, height: 240 }} contentFit="contain" />
    </View>
  );
}
