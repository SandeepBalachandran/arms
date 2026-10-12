import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Apple, CalendarDays, CreditCard, Dumbbell, House, User, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useNutritionAccess } from '@/lib/nutrition';
import { saveSplashBrand } from '@/lib/splash-brand';

// Tab bar along the bottom: icon and label, the current tab's icon on a lime pill.
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
    { name: 'membership', href: '/membership', label: 'Pass', a11y: 'Membership pass', icon: CreditCard, shown: true },
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
      <TabList style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {tabs.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild style={t.shown ? undefined : styles.hidden}>
            <TabButton label={t.label} a11y={'a11y' in t ? t.a11y : t.label} icon={t.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({ label, a11y, icon: Icon, isFocused, style, ...props }: TabTriggerSlotProps & { label: string; a11y: string; icon: LucideIcon }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  // The lime pill springs in on the newly selected tab.
  const scale = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    scale.set(reduced ? (isFocused ? 1 : 0) : withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 180 }));
  }, [isFocused, reduced, scale]);
  const blob = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: scale.value }));
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: isFocused }}
      style={(state) => [styles.tab, typeof style === 'function' ? style(state) : style]}>
      <View style={styles.pill}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: theme.accent }, blob]} />
        {/* zIndex keeps the icon above the (positioned) animated pill. */}
        <View style={{ zIndex: 1 }}>
          <Icon size={21} color={isFocused ? theme.accentText : theme.textSecondary} strokeWidth={isFocused ? 2.4 : 2} />
        </View>
      </View>
      <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '700', color: isFocused ? theme.text : theme.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  pill: { width: 50, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
