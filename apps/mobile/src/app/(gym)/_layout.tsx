import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Apple, CalendarDays, CreditCard, Dumbbell, House, User, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useNutritionAccess } from '@/lib/nutrition';
import { saveSplashBrand } from '@/lib/splash-brand';

// Floating dark tab bar with icon buttons; the current tab is a lime circle.
// Optional features (classes, workouts, nutrition) hide their tab.
export default function GymTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gym = useActiveGym()?.gym;
  const nutrition = useNutritionAccess();
  // Remember this gym for the splash screen next time.
  useEffect(() => {
    if (gym) saveSplashBrand({ name: gym.name, logo_url: gym.logo_url });
  }, [gym?.name, gym?.logo_url]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = [
    { name: 'index', href: '/', label: 'Home', icon: House, shown: true },
    { name: 'classes', href: '/classes', label: 'Classes', icon: CalendarDays, shown: !!gym?.classes_enabled },
    { name: 'workouts', href: '/workouts', label: 'Workouts', icon: Dumbbell, shown: !!gym?.workouts_enabled },
    { name: 'food', href: '/food', label: 'Food', icon: Apple, shown: nutrition.available },
    { name: 'membership', href: '/membership', label: 'Membership', icon: CreditCard, shown: true },
    { name: 'profile', href: '/profile', label: 'Profile', icon: User, shown: true },
  ] as const;

  return (
    <Tabs style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Each screen fills the space above the bar and scrolls inside it. */}
      <TabSlot
        style={styles.slot}
        renderFn={(descriptor, { isFocused, loaded }) =>
          loaded ? (
            <View key={descriptor.route.key} style={[styles.slot, !isFocused && styles.hidden]}>
              {descriptor.render()}
            </View>
          ) : null
        }
      />
      {/* Must stay a direct child of Tabs: expo-router reads the triggers from it. */}
      <TabList style={[styles.bar, { backgroundColor: theme.hero, marginBottom: Math.max(insets.bottom, 12) }]}>
        {tabs.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild style={t.shown ? undefined : styles.hidden}>
            <TabButton label={t.label} icon={t.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({ label, icon: Icon, isFocused, style, ...props }: TabTriggerSlotProps & { label: string; icon: LucideIcon }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  // The lime circle springs in on the newly selected tab.
  const scale = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    scale.set(reduced ? (isFocused ? 1 : 0) : withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 180 }));
  }, [isFocused, reduced, scale]);
  const blob = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: scale.value }));
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={(state) => [styles.tab, typeof style === 'function' ? style(state) : style]}>
      <View style={styles.circle}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: theme.accent }, blob]} />
        {/* zIndex keeps the icon above the (positioned) animated circle. */}
        <View style={{ zIndex: 1 }}>
          <Icon size={22} color={isFocused ? theme.accentText : theme.heroMuted} strokeWidth={isFocused ? 2.4 : 2} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
  bar: {
    flexDirection: 'row',
    borderRadius: 999,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-around',
  },
  tab: { flex: 1, alignItems: 'center' },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
