import {
  dayKey,
  daysBetween,
  formatDate,
  formatDay,
  formatMoney,
  formatRange,
  formatSessionsLeft,
  formatTime,
  groupPlanDays,
  hasStarted,
  openStatus,
  parseOpeningHours,
  todayHoursDay,
  todayIn,
} from '@gymos/shared';
import { useRouter, type Href } from 'expo-router';
import {
  Bell,
  CalendarDays,
  Clock,
  CreditCard,
  Dumbbell,
  HeartHandshake,
  Timer,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Appear, Float, PressableScale } from '@/components/motion';
import { ProgressRing } from '@/components/progress-ring';
import { IconButton, Text } from '@/components/ui';
import { Spacing, type Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSchedule } from '@/lib/classes';
import { useActiveGym } from '@/lib/gyms';
import { useMembership, usePaymentClaims, usePlans } from '@/lib/memberships';
import { useProfile } from '@/lib/profile';
import { useMyPt } from '@/lib/pt';
import { useMyPlans } from '@/lib/workouts';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

// Avatar, greeting and a bell that lights up when something needs attention.
export function HomeHeader() {
  const theme = useTheme();
  const router = useRouter();
  const gym = useActiveGym()?.gym;
  const profile = useProfile();
  const { state } = useMembership();
  const claims = usePaymentClaims();
  const name = profile.data?.full_name || '';
  const attention =
    !!claims.data?.pending ||
    !!claims.data?.rejected.length ||
    state?.kind === 'expired' ||
    (state?.kind === 'active' && !state.next && state.daysLeft <= (gym?.expiry_warning_days ?? 7));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      <Pressable
        onPress={() => router.push('/profile')}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.accentText }}>{initials(name || 'Me')}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="muted" style={{ fontSize: 14 }}>
          {gym ? greeting(gym.timezone) : 'Hello'}
        </Text>
        <Text style={{ fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
          {name.split(' ')[0] || 'there'}
        </Text>
      </View>
      <IconButton label={attention ? 'Membership needs attention' : 'Membership'} dot={attention} onPress={() => router.push('/membership')}>
        <Bell size={22} color={theme.text} />
      </IconButton>
    </View>
  );
}

// "Workout Progress!"-style strip: membership days left as a ring.
export function MembershipProgress() {
  const theme = useTheme();
  const router = useRouter();
  const gym = useActiveGym()?.gym;
  const { state } = useMembership();
  if (!state || !gym) return null;

  let title = 'No active plan';
  let sub = 'See plans and prices →';
  let ring: ReactNode = null;
  if (state.kind === 'active') {
    const end = state.next?.ends_on ?? state.current.ends_on;
    const total = daysBetween(state.current.starts_on, end) + 1;
    const warn = !state.next && state.daysLeft <= gym.expiry_warning_days;
    title = warn ? 'Renew soon!' : 'Membership active';
    sub = `${state.current.plan_name} · till ${formatDate(end)}`;
    ring = <ProgressRing value={state.daysLeft / total} label={`${state.daysLeft}d`} warn={warn} />;
  } else if (state.kind === 'upcoming') {
    title = 'Membership starts soon';
    sub = `${state.next.plan_name} · from ${formatDate(state.next.starts_on)}`;
    ring = <ProgressRing value={0} label={`${state.startsIn}d`} />;
  } else if (state.kind === 'expired') {
    title = 'Membership expired';
    sub = `Ended ${formatDate(state.last.ends_on)} · Renew →`;
    ring = <ProgressRing value={0} label="0d" warn />;
  }

  return (
    <PressableScale
      onPress={() => router.push('/membership')}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        backgroundColor: theme.progress,
        borderRadius: 20,
        padding: Spacing.three,
        paddingVertical: 14,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>{title}</Text>
        <Text variant="muted" style={{ fontSize: 14 }}>
          {sub}
        </Text>
      </View>
      {ring}
    </PressableScale>
  );
}

// Big dark card: the next booked class, else today's workout plan, else
// today's opening hours.
export function TodayHero() {
  const router = useRouter();
  const gym = useActiveGym()?.gym;
  const schedule = useSchedule();
  const plans = useMyPlans();
  if (!gym) return null;

  const nextClass = schedule.data?.find((c) => c.status === 'scheduled' && c.my_status === 'booked' && !hasStarted(c.starts_at));
  const plan = plans.data?.[0];

  if (nextClass) {
    const day = dayKey(nextClass.starts_at, gym.timezone);
    return (
      <Hero
        icon={CalendarDays}
        chips={[`${day === todayIn(gym.timezone) ? 'Today' : formatDay(day)} · ${formatTime(nextClass.starts_at, gym.timezone)}`, `${nextClass.duration_min} min`]}
        kicker="Your next class"
        title={nextClass.class_name}
        sub={[nextClass.trainer_name, nextClass.room].filter(Boolean).join(' · ') || undefined}
        onPress={() => router.push('/classes')}
      />
    );
  }
  if (plan) {
    const days = groupPlanDays(plan.workout_plan_items);
    const exercises = plan.workout_plan_items.length;
    return (
      <Hero
        icon={Dumbbell}
        chips={[`${days.length} ${days.length === 1 ? 'day' : 'days'}`, `${exercises} exercises`]}
        kicker="Your workout plan"
        title={plan.name}
        sub={days.map((d) => d.label).join(' · ')}
        onPress={() => router.push('/workouts')}
      />
    );
  }
  const hours = parseOpeningHours(gym.opening_hours);
  const status = openStatus(hours, gym.timezone);
  const today = hours[todayHoursDay(gym.timezone)];
  return (
    <Hero
      icon={Clock}
      chips={[today.morning ? `Morning ${formatRange(today.morning)}` : 'Morning closed', today.evening ? `Evening ${formatRange(today.evening)}` : 'Evening closed']}
      kicker={gym.name}
      title={status.open ? 'Open now' : 'Closed now'}
      sub={gym.opening_hours_note ?? (gym.address || undefined)}
    />
  );
}

function Hero({ icon: Icon, chips, kicker, title, sub, onPress }: {
  icon: LucideIcon;
  chips: string[];
  kicker: string;
  title: string;
  sub?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        backgroundColor: theme.hero,
        borderRadius: 24,
        padding: 20,
        minHeight: 180,
        overflow: 'hidden',
        justifyContent: 'space-between',
      }}>
      {/* Decoration: a lime glow and a big faint icon. */}
      <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: theme.accent, opacity: 0.16 }} />
      <Float distance={8} style={{ position: 'absolute', right: 12, bottom: -18, opacity: 0.18 }}>
        <Icon size={150} color={theme.accent} strokeWidth={1.4} />
      </Float>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {chips.map((c, i) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            {i === 0 ? <Clock size={13} color={theme.accent} /> : <Timer size={13} color={theme.accent} />}
            <Text style={{ color: theme.heroText, fontSize: 12, fontWeight: '600' }}>{c}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: Spacing.four, maxWidth: '75%', gap: 2 }}>
        <Text style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '600' }}>{kicker}</Text>
        <Text style={{ color: theme.heroText, fontSize: 24, fontWeight: '800', lineHeight: 28 }} numberOfLines={2}>
          {title}
        </Text>
        {sub && (
          <Text style={{ color: theme.heroMuted, fontSize: 14 }} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

type Tile = { key: string; title: string; sub: string; meta: string; icon: LucideIcon; tint: Tint; href: Href };

// Pastel shortcut tiles for the features this gym uses.
export function ExploreTiles() {
  const gym = useActiveGym()?.gym;
  const schedule = useSchedule();
  const plans = useMyPlans();
  const pt = useMyPt();
  const gymPlans = usePlans();
  if (!gym) return null;

  const upcoming = schedule.data?.filter((c) => c.status === 'scheduled' && !hasStarted(c.starts_at)) ?? [];
  const myPt = pt.data?.find((s) => s.state.kind === 'active');
  const cheapest = gymPlans.data?.length ? Math.min(...gymPlans.data.map((p) => p.price_paise)) : null;

  const tiles: Tile[] = [
    ...(gym.classes_enabled
      ? [{ key: 'classes', title: 'Group classes', sub: `${upcoming.length} coming up`, meta: 'Book a spot', icon: CalendarDays, tint: 'blue' as const, href: '/classes' as const }]
      : []),
    ...(gym.workouts_enabled
      ? [{ key: 'workouts', title: 'Workout plans', sub: `${plans.data?.length ?? 0} assigned`, meta: 'Log a workout', icon: Dumbbell, tint: 'green' as const, href: '/workouts' as const }]
      : []),
    ...(gym.pt_enabled && (myPt || gym.pt_show_in_app)
      ? [{ key: 'pt', title: 'Personal training', sub: myPt ? formatSessionsLeft(myPt, myPt.sessions.length) : 'With a trainer', meta: myPt ? 'Your package' : 'See packages', icon: HeartHandshake, tint: 'pink' as const, href: '/membership' as const }]
      : []),
    { key: 'plans', title: 'Plans & renew', sub: cheapest !== null ? `From ${formatMoney(cheapest, gym.currency)}` : 'Membership', meta: 'Receipts too', icon: CreditCard, tint: 'yellow', href: '/membership' },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: Spacing.three }} style={{ marginHorizontal: -Spacing.three, paddingLeft: Spacing.three }}>
      {tiles.map((t, i) => (
        <Appear key={t.key} index={i + 2}>
          <TileCard tile={t} />
        </Appear>
      ))}
    </ScrollView>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const theme = useTheme();
  const router = useRouter();
  const tint = theme.tints[tile.tint];
  const Icon = tile.icon;
  return (
    <PressableScale
      onPress={() => router.push(tile.href)}
      accessibilityRole="button"
      style={{ width: 150, minHeight: 168, borderRadius: 22, padding: 14, backgroundColor: tint.bg, justifyContent: 'space-between' }}>
      <Icon size={34} color={tint.fg} strokeWidth={2.2} />
      <View style={{ gap: 2, marginTop: Spacing.three }}>
        <Text style={{ fontSize: 15, fontWeight: '700' }}>{tile.title}</Text>
        <Text variant="small">{tile.sub}</Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: '700', marginTop: Spacing.two }}>{tile.meta} →</Text>
    </PressableScale>
  );
}
