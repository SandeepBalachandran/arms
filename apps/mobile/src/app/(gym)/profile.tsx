import { rolesLabel, TEAM_ROLES } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Apple, Camera, Check, ChevronRight, LayoutDashboard, LogOut, Moon, Pencil, Plus, ScanLine, Sun, Trash2, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { z } from 'zod';

import { Avatar } from '@/components/avatar';
import { Appear } from '@/components/motion';
import { PhotoSheet } from '@/components/photo-sheet';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import type { Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteMyAccount } from '@/lib/account';
import { useActivity } from '@/lib/activity';
import { setScheme, useScheme } from '@/lib/appearance';
import { useSetAvatar } from '@/lib/avatar';
import { confirm } from '@/lib/confirm';
import { useActiveGym, useMyGyms, useMyPermissions, useSetActiveGym } from '@/lib/gyms';
import { useNutritionAccess } from '@/lib/nutrition';
import { profileKey, useProfile, useSetLanguage } from '@/lib/profile';
import { useSession } from '@/lib/session';
import { openAdmin } from '@/lib/site-view';
import { saveSplashBrand } from '@/lib/splash-brand';
import { supabase } from '@/lib/supabase';

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z.string().trim().max(20).transform((v) => v || null),
});

export default function ProfileScreen() {
  const { session } = useSession();
  const profile = useProfile();
  const router = useRouter();
  const active = useActiveGym();
  const [editing, setEditing] = useState(false);
  const nutrition = useNutritionAccess();
  const { can } = useMyPermissions();
  const isTeam = !!useMyGyms().data?.some((m) => TEAM_ROLES.includes(m.role));
  const canScan = !!active?.gym.checkin_enabled && can('check_in_members');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  async function deleteAccount() {
    const ok = await confirm({
      title: 'Delete your account?',
      message:
        'Your name, phone, photo, workouts, body measurements and food log are deleted, and you can’t sign in to this account again. Your gyms keep their payment and visit records as “Deleted member”.',
      confirmText: 'Delete my account',
    });
    if (!ok || !session) return;
    setDeleteError(undefined);
    setDeleting(true);
    try {
      saveSplashBrand(null);
      await deleteMyAccount(session.user.id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Couldn’t delete your account. Try again.');
      setDeleting(false);
    }
  }

  async function signOut() {
    if (await confirm({ title: 'Sign out?', message: 'You can sign back in any time.', confirmText: 'Sign out' })) {
      saveSplashBrand(null);
      supabase.auth.signOut();
    }
  }

  return (
    <Screen>
      <Appear index={0}>
        <ProfileHero onEdit={() => setEditing((e) => !e)} />
      </Appear>

      {editing && profile.data && (
        <ProfileForm
          key={session?.user.id}
          fullName={profile.data.full_name}
          phone={profile.data.phone ?? ''}
          onDone={() => setEditing(false)}
        />
      )}

      <Appear index={1}>
        <Stats />
      </Appear>

      <Appear index={2} style={{ gap: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }} variant="small">PREFERENCES</Text>
        <AppearancePicker />
        {active?.gym.workouts_enabled && <LanguagePicker />}
      </Appear>

      <Appear index={3} style={{ gap: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }} variant="small">GYMS</Text>
        <Card style={{ padding: 6, gap: 0 }}>
          <GymSwitcher />
          {nutrition.available && <Row icon={Apple} tint="yellow" label="Nutrition details" detail="Height, weight, food preference" onPress={() => router.push('/food/setup')} />}
          {canScan && <Row icon={ScanLine} tint="blue" label="Front desk: scan check-ins" onPress={() => router.push('/staff/scan')} />}
          {openAdmin && isTeam && <Row icon={LayoutDashboard} tint="blue" label="Open the admin" detail="Run the gym from your phone" onPress={openAdmin} />}
          <Row icon={Plus} tint="green" label="Join another gym" onPress={() => router.push('/join')} />
        </Card>
      </Appear>

      <Appear index={4}>
        <Card style={{ padding: 6 }}>
          <Row icon={LogOut} tint="pink" label="Sign out" danger onPress={signOut} chevron={false} />
          <Row
            icon={Trash2}
            tint="pink"
            label={deleting ? 'Deleting…' : 'Delete account'}
            detail="Your account and personal details"
            danger
            onPress={deleting ? undefined : deleteAccount}
            chevron={false}
          />
        </Card>
        {deleteError && <Text variant="error" style={{ marginTop: 8 }}>{deleteError}</Text>}
      </Appear>
    </Screen>
  );
}

function ProfileHero({ onEdit }: { onEdit: () => void }) {
  const theme = useTheme();
  const { session } = useSession();
  const profile = useProfile();
  const active = useActiveGym();
  const name = profile.data?.full_name || 'Add your name';
  const contact = session?.user.email || profile.data?.phone || '';
  const [sheet, setSheet] = useState(false);
  const setAvatar = useSetAvatar();
  const hasPhoto = !!profile.data?.avatar_url;

  return (
    <Card style={{ backgroundColor: theme.hero, borderColor: theme.hero, padding: 20, alignItems: 'center', gap: 6, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: -50, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(200,240,75,0.12)' }} />
      <View style={{ position: 'absolute', right: -40, bottom: -60, width: 160, height: 160, borderRadius: 80, borderWidth: 24, borderColor: 'rgba(255,255,255,0.05)' }} />
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit your details"
        hitSlop={8}
        style={{ position: 'absolute', right: 14, top: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Pencil size={17} color={theme.heroText} />
      </Pressable>

      <Pressable
        onPress={() => setSheet(true)}
        disabled={setAvatar.isPending}
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? 'Change your photo' : 'Add your photo'}
        style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(200,240,75,0.45)', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
        <Avatar name={profile.data?.full_name || 'Me'} path={profile.data?.avatar_url} size={76} />
        {setAvatar.isPending && (
          <View style={{ position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#ffffff" />
          </View>
        )}
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.accent, borderWidth: 3, borderColor: theme.hero, alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={14} color={theme.accentText} />
        </View>
      </Pressable>
      <PhotoSheet visible={sheet} hasPhoto={hasPhoto} onClose={() => setSheet(false)} onPick={(source) => setAvatar.mutate(source)} />
      {setAvatar.error && (
        <Text style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>{setAvatar.error.message}</Text>
      )}
      <Text style={{ color: theme.heroText, fontSize: 22, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{name}</Text>
      {!!contact && <Text style={{ color: theme.heroMuted, fontSize: 14 }}>{contact}</Text>}
      {active && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <Text style={{ color: theme.heroText, fontSize: 12, fontWeight: '600' }}>{active.gym.name}</Text>
          </View>
          <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: theme.accent }}>
            <Text style={{ color: theme.accentText, fontSize: 12, fontWeight: '700' }}>{rolesLabel(active.role, active.extraRoles)}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

// This month's visits, streak and this week at a glance.
function Stats() {
  const theme = useTheme();
  const activity = useActivity();
  if (!activity.available) return null;
  const items: { value: number; label: string; tint: Tint }[] = [
    { value: activity.monthDays, label: 'days this month', tint: 'green' },
    { value: activity.streak, label: 'day streak', tint: 'yellow' },
    { value: activity.weekDays, label: 'this week', tint: 'blue' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {items.map((s) => (
        <View key={s.label} style={{ flex: 1, borderRadius: 20, padding: 14, gap: 2, backgroundColor: theme.tints[s.tint].bg }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: theme.tints[s.tint].fg }}>{s.value}</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.tints[s.tint].fg }}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Row({ icon: Icon, tint, label, detail, onPress, danger, chevron = true, right }: {
  icon: LucideIcon;
  tint: Tint;
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  right?: ReactNode;
}) {
  const theme = useTheme();
  const colors = theme.tints[tint];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={danger ? theme.danger : colors.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: danger ? theme.danger : theme.text }}>{label}</Text>
        {detail && <Text variant="small">{detail}</Text>}
      </View>
      {right}
      {chevron && onPress && <ChevronRight size={18} color={theme.textSecondary} />}
    </Pressable>
  );
}

function ProfileForm({ fullName, phone, onDone }: { fullName: string; phone: string; onDone: () => void }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ full_name: fullName, phone });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase.from('profiles').update(parsed.data).eq('id', session!.user.id);
    setSaving(false);
    if (error) return setError(error.message);
    queryClient.invalidateQueries({ queryKey: profileKey(session?.user.id) });
    onDone();
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text variant="heading">Your details</Text>
      <Input
        label="Full name"
        value={values.full_name}
        onChangeText={(full_name) => setValues((v) => ({ ...v, full_name }))}
        autoComplete="name"
      />
      <Input
        label="Phone"
        value={values.phone}
        onChangeText={(phone) => setValues((v) => ({ ...v, phone }))}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      {error && <Text variant="error">{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function GymSwitcher() {
  const theme = useTheme();
  const { data: gyms } = useMyGyms();
  const active = useActiveGym();
  const setActive = useSetActiveGym();
  if (!gyms || gyms.length < 2) return null;

  return gyms.map(({ gym, role }) => {
    const selected = gym.slug === active?.gym.slug;
    return (
      <Row
        key={gym.id}
        icon={selected ? Check : ChevronRight}
        tint="green"
        label={gym.name}
        detail={role === 'member' ? undefined : role}
        onPress={selected ? undefined : () => setActive(gym.slug)}
        right={selected ? <Text style={{ color: theme.brand, fontWeight: '700', fontSize: 13 }}>Current</Text> : undefined}
      />
    );
  });
}

function AppearancePicker() {
  const theme = useTheme();
  const scheme = useScheme();
  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 6, padding: 5, borderRadius: 999, backgroundColor: theme.surfaceMuted }} accessibilityRole="radiogroup">
      {options.map(({ value, label, icon: Icon }) => {
        const selected = scheme === value;
        return (
          <Pressable
            key={value}
            onPress={() => setScheme(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: 46,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: selected ? theme.hero : 'transparent',
            }}>
            <Icon size={17} color={selected ? theme.accent : theme.textSecondary} />
            <Text style={{ color: selected ? theme.heroText : theme.textSecondary, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Language for exercise guides (how-to text the gym writes in English and
// Malayalam). Falls back to English when a guide has no Malayalam.
function LanguagePicker() {
  const theme = useTheme();
  const language = useProfile().data?.language ?? 'en';
  const setLanguage = useSetLanguage();
  const options = [
    { value: 'en' as const, label: 'English' },
    { value: 'ml' as const, label: 'മലയാളം' },
  ];
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small">Exercise guides in</Text>
      <View style={{ flexDirection: 'row', gap: 6, padding: 5, borderRadius: 999, backgroundColor: theme.surfaceMuted }} accessibilityRole="radiogroup" accessibilityLabel="Exercise guide language">
        {options.map(({ value, label }) => {
          const selected = language === value;
          return (
            <Pressable
              key={value}
              onPress={() => !selected && setLanguage.mutate(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: selected ? theme.hero : 'transparent' }}>
              <Text style={{ color: selected ? theme.heroText : theme.textSecondary, fontWeight: '700' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
