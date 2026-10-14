import { Download, Share, Smartphone, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// For members using GOS in the browser: put it on the home screen.
// - Chrome/Edge on Android: an Install button (the browser's own prompt).
// - iPhone/iPad Safari: how to do it from the Share menu (no prompt there).
// - Android without the prompt: a link to the APK, when one is set.
// Hidden once installed, on desktop, and for two weeks after closing it.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __gosInstallPrompt?: InstallPrompt;
  }
}

const DISMISS_KEY = 'gymos.installDismissedAt';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
const ANDROID_APP_URL = process.env.EXPO_PUBLIC_ANDROID_APP_URL;

function initialState() {
  const ua = navigator.userAgent;
  const installed =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  let dismissed = false;
  try {
    dismissed = Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_MS;
  } catch {}
  return {
    hidden: installed || dismissed,
    ios: /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1),
    android: /android/i.test(ua),
  };
}

export function InstallBanner() {
  const [env] = useState(initialState);
  const [hidden, setHidden] = useState(env.hidden);
  const [prompt, setPrompt] = useState(() => window.__gosInstallPrompt);

  useEffect(() => {
    const ready = () => setPrompt(window.__gosInstallPrompt);
    const installed = () => setHidden(true);
    window.addEventListener('gos-installable', ready);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('gos-installable', ready);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__gosInstallPrompt = undefined;
    setPrompt(undefined);
    if (outcome === 'accepted') setHidden(true);
  }

  if (hidden) return null;
  if (prompt) {
    return (
      <Banner icon={Download} title="Install GOS" body="Opens like an app from your home screen. No Play Store needed." onClose={dismiss}>
        <Action title="Install" onPress={install} />
      </Banner>
    );
  }
  if (env.ios) {
    return (
      <Banner
        icon={Share}
        title="Add GOS to your Home Screen"
        body="Tap Share in Safari, then “Add to Home Screen”. It opens like an app."
        onClose={dismiss}
      />
    );
  }
  if (env.android && ANDROID_APP_URL) {
    return (
      <Banner icon={Smartphone} title="Get the Android app" body="Faster check-in with the GOS app." onClose={dismiss}>
        <Action title="Download" onPress={() => Linking.openURL(ANDROID_APP_URL)} />
      </Banner>
    );
  }
  return null;
}

function Banner({ icon: Icon, title, body, onClose, children }: { icon: LucideIcon; title: string; body: string; onClose: () => void; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: theme.hero }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={theme.accentText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.heroText, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: theme.heroMuted, fontSize: 12.5 }}>{body}</Text>
      </View>
      {children}
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Not now" hitSlop={8} style={{ padding: 4, marginLeft: -Spacing.one }}>
        <X size={18} color={theme.heroMuted} />
      </Pressable>
    </View>
  );
}

function Action({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: theme.accentText, fontWeight: '800', fontSize: 13 }}>{title}</Text>
    </Pressable>
  );
}
