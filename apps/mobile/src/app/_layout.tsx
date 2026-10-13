import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { SplashView } from '@/components/splash-view';
import { ConfirmHost } from '@/lib/confirm';
import { useScheme } from '@/lib/appearance';
import { ActiveGymProvider, checkInstallReferrer, takePendingJoin, useMyGyms } from '@/lib/gyms';
import { SessionProvider, useSession } from '@/lib/session';
import { hasSeenWelcome } from '@/lib/welcome';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

const queryClient = new QueryClient();
const SPLASH_MIN_MS = 1400;

// Coming back to the app counts as "focus", so data on screen (including gym
// settings like which features are on) refreshes. Browsers do this already.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

export default function RootLayout() {
  const scheme = useScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ActiveGymProvider>
            <RootNavigator />
            <ConfirmHost />
          </ActiveGymProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// A screen threw while rendering. Release builds would otherwise close the
// app; show what went wrong so it can be reported, and offer a retry.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#1f2a10', padding: 24, paddingTop: 80, gap: 16 }}>
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800' }}>Something went wrong</Text>
      <Text style={{ color: '#c3cdb2', fontSize: 15 }}>
        Try again. If it keeps happening, send a screenshot of this screen to your gym.
      </Text>
      <ScrollView style={{ maxHeight: 220, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }} contentContainerStyle={{ padding: 12 }}>
        <Text selectable style={{ color: '#ffffff', fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
          {error.name}: {error.message}
        </Text>
      </ScrollView>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={({ pressed }) => ({ backgroundColor: '#c8f04b', borderRadius: 999, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: '#141a04', fontSize: 16, fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

// Signed out → intro slides (first launch only) → sign-in. Signed in without a gym → join. Otherwise → gym tabs.
// join/[slug] is reachable in every state so join links always resolve.
function RootNavigator() {
  const { session, isLoading } = useSession();
  const gyms = useMyGyms();
  const signedIn = !!session;
  const hasGym = !!gyms.data?.length;
  // Read once: after the intro, welcome.tsx replaces itself with sign-in.
  const [welcomed] = useState(hasSeenWelcome);
  // Keys match Fonts in constants/theme.ts. On error, fall back to the system font.
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  const loaded = !isLoading && (!signedIn || !gyms.isPending);
  // The animated splash stays at least this long so it reads as a moment, not a flicker.
  const [minShown, setMinShown] = useState(false);

  useEffect(() => {
    checkInstallReferrer();
  }, []);

  // Swap the static native splash for the animated one as soon as text can render.
  useEffect(() => {
    if (!fontsReady) return;
    SplashScreen.hide();
    const timer = setTimeout(() => setMinShown(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, [fontsReady]);

  if (!fontsReady) return null; // native splash is still showing
  if (!loaded || !minShown) return <SplashView />;

  return (
    <>
      <PendingJoinHandler enabled={signedIn} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Protected guard={!welcomed}>
            <Stack.Screen name="welcome" />
          </Stack.Protected>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Protected guard={hasGym}>
            <Stack.Screen name="(gym)" />
            <Stack.Screen
              name="pay/[planId]"
              options={{ headerShown: true, title: 'Pay with UPI', presentation: 'modal' }}
            />
            <Stack.Screen
              name="checkin-qr"
              options={{ headerShown: true, title: 'Check-in code', presentation: 'modal' }}
            />
            <Stack.Screen name="food/add" options={{ headerShown: true, title: 'Add food', presentation: 'modal' }} />
            <Stack.Screen name="food/setup" options={{ headerShown: true, title: 'Nutrition setup' }} />
            <Stack.Screen name="food/water" options={{ headerShown: true, title: 'Water' }} />
            <Stack.Screen name="checkin-scan" options={{ headerShown: true, title: 'Scan to check in' }} />
            <Stack.Screen name="staff/scan" options={{ headerShown: true, title: 'Front desk scan' }} />
            <Stack.Screen name="workout/log" options={{ headerShown: true, title: 'Log workout', gestureEnabled: false }} />
            <Stack.Screen name="workout/[logId]" options={{ headerShown: true, title: 'Edit workout', gestureEnabled: false }} />
            <Stack.Screen name="progress" options={{ headerShown: true, title: 'Progress' }} />
            <Stack.Screen name="receipt/[id]" options={{ headerShown: true, title: 'Receipt' }} />
            <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
          </Stack.Protected>
          <Stack.Screen name="join/index" options={{ headerShown: hasGym, title: 'Join a gym' }} />
        </Stack.Protected>
        <Stack.Screen name="join/[slug]" options={{ headerShown: true, title: 'Join gym' }} />
      </Stack>
    </>
  );
}

// After sign-in, continue a join that started while signed out (or from the
// install referrer).
function PendingJoinHandler({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const slug = takePendingJoin();
    if (slug) router.push({ pathname: '/join/[slug]', params: { slug } });
  }, [enabled, router]);
  return null;
}
