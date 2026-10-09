import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';

// Optional features hide their tab. Android allows at most 5 tabs, so
// Progress is a screen inside Workouts rather than its own tab.
export default function GymTabs() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  return (
    <NativeTabs
      backgroundColor={theme.surface}
      indicatorColor={theme.border}
      tintColor={theme.brand}
      labelStyle={{ selected: { color: theme.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="classes" hidden={!gym?.classes_enabled}>
        <NativeTabs.Trigger.Label>Classes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts" hidden={!gym?.workouts_enabled}>
        <NativeTabs.Trigger.Label>Workouts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="membership">
        <NativeTabs.Trigger.Label>Membership</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard.fill" md="card_membership" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
