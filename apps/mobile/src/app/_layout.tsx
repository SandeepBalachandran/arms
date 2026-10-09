import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { ActiveGymProvider, checkInstallReferrer, takePendingJoin, useMyGyms } from '@/lib/gyms';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ActiveGymProvider>
            <RootNavigator />
          </ActiveGymProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Signed out → sign-in. Signed in without a gym → join. Otherwise → gym tabs.
// join/[slug] is reachable in every state so join links always resolve.
function RootNavigator() {
  const { session, isLoading } = useSession();
  const gyms = useMyGyms();
  const signedIn = !!session;
  const hasGym = !!gyms.data?.length;
  const ready = !isLoading && (!signedIn || !gyms.isPending);

  useEffect(() => {
    checkInstallReferrer();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <PendingJoinHandler enabled={signedIn} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
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
            <Stack.Screen name="staff/scan" options={{ headerShown: true, title: 'Front desk scan' }} />
            <Stack.Screen name="workout/log" options={{ headerShown: true, title: 'Log workout', gestureEnabled: false }} />
            <Stack.Screen name="progress" options={{ headerShown: true, title: 'Progress' }} />
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
