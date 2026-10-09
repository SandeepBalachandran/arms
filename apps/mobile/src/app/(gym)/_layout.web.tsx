import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';

// Web version of the tab bar: native tabs render as a floating strip at the
// top in a browser, so web gets a plain bottom bar built on expo-router/ui.
// Optional features hide their tab, as on Android.
export default function GymTabs() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const tabs = [
    { name: 'index', href: '/', label: 'Home', shown: true },
    { name: 'classes', href: '/classes', label: 'Classes', shown: !!gym?.classes_enabled },
    { name: 'workouts', href: '/workouts', label: 'Workouts', shown: !!gym?.workouts_enabled },
    { name: 'membership', href: '/membership', label: 'Membership', shown: true },
    { name: 'profile', href: '/profile', label: 'Profile', shown: true },
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
      <TabList style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {tabs.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild style={t.shown ? undefined : { display: 'none' }}>
            <TabButton label={t.label} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({ label, isFocused, style, ...props }: TabTriggerSlotProps & { label: string }) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={(state) => [styles.tab, typeof style === 'function' ? style(state) : style]} accessibilityRole="tab" accessibilityState={{ selected: isFocused }}>
      <View style={[styles.pill, isFocused && { backgroundColor: theme.border }]}>
        <Text style={[styles.label, { color: isFocused ? theme.text : theme.textSecondary }]}>{label}</Text>
      </View>
      {isFocused && <View style={[styles.dot, { backgroundColor: theme.brand }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
