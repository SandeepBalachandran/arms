import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { CalendarDays, CreditCard, Dumbbell, House, User, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';

// Floating dark tab bar with icon buttons; the current tab is a lime circle.
// Optional features (classes, workouts) hide their tab.
export default function GymTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gym = useActiveGym()?.gym;
  const tabs = [
    { name: 'index', href: '/', label: 'Home', icon: House, shown: true },
    { name: 'classes', href: '/classes', label: 'Classes', icon: CalendarDays, shown: !!gym?.classes_enabled },
    { name: 'workouts', href: '/workouts', label: 'Workouts', icon: Dumbbell, shown: !!gym?.workouts_enabled },
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
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={(state) => [styles.tab, typeof style === 'function' ? style(state) : style]}>
      <View style={[styles.circle, isFocused && { backgroundColor: theme.accent }]}>
        <Icon size={22} color={isFocused ? theme.accentText : theme.heroMuted} strokeWidth={isFocused ? 2.4 : 2} />
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
