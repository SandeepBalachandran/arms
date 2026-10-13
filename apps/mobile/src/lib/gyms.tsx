import { parseGymCode, type Database, type GymRole, type Permission } from '@gymos/shared';
import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { createContext, use, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type GymMembership = {
  memberId: string;
  role: GymRole;
  // Roles besides the main one (e.g. an owner who also trains).
  extraRoles: GymRole[];
  status: Database['public']['Enums']['member_status'];
  // The whole gym row, including its settings (configured in the web admin).
  gym: Database['public']['Tables']['gyms']['Row'];
};

export const myGymsKey = (userId: string | undefined) => ['my-gyms', userId] as const;

// All of the signed-in user's gym memberships (active and awaiting approval).
function useMemberships<T>(select: (rows: GymMembership[]) => T) {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: myGymsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<GymMembership[]> => {
      const { data, error } = await supabase
        .from('gym_members')
        .select('id, role, extra_roles, status, gyms!inner(*)')
        .eq('user_id', userId!)
        .in('status', ['active', 'pending'])
        .eq('gyms.status', 'active')
        .order('joined_at');
      if (error) throw error;
      return data.map((row) => ({ memberId: row.id, role: row.role, extraRoles: row.extra_roles, status: row.status, gym: row.gyms }));
    },
    select,
  });
}

const activeOnly = (rows: GymMembership[]) => rows.filter((m) => m.status === 'active');
const pendingOnly = (rows: GymMembership[]) => rows.filter((m) => m.status === 'pending');

// Gyms the user can use (same as apps/web getMyGyms).
export function useMyGyms() {
  return useMemberships(activeOnly);
}

// Gyms that still have to approve the user (gym setting "Approve new members").
export function usePendingGyms() {
  return useMemberships(pendingOnly);
}

// Active gym ------------------------------------------------------------------

const ACTIVE_GYM_KEY = 'gymos.activeGym';

type ActiveGymState = { activeSlug: string | null; setActiveSlug: (slug: string) => void };

const ActiveGymContext = createContext<ActiveGymState>({ activeSlug: null, setActiveSlug: () => {} });

export function ActiveGymProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setSlug] = useState(() => localStorage.getItem(ACTIVE_GYM_KEY));
  const setActiveSlug = (slug: string) => {
    localStorage.setItem(ACTIVE_GYM_KEY, slug);
    setSlug(slug);
  };
  return <ActiveGymContext value={{ activeSlug, setActiveSlug }}>{children}</ActiveGymContext>;
}

// The gym the app is showing: the one picked last, else the first joined.
export function useActiveGym(): GymMembership | null {
  const { activeSlug } = use(ActiveGymContext);
  const { data: gyms } = useMyGyms();
  if (!gyms?.length) return null;
  return gyms.find((m) => m.gym.slug === activeSlug) ?? gyms[0];
}

// What the signed-in user may do in the active gym (the owner's grid, see
// has_permission in the database). Empty until loaded, so buttons only
// appear once we know. Member-side permissions default to allowed, so a
// member isn't blocked while this loads.
export function useMyPermissions() {
  const gymId = useActiveGym()?.gym.id;
  const query = useQuery({
    queryKey: ['my-permissions', gymId],
    enabled: !!gymId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_permissions', { p_gym_id: gymId! });
      if (error) throw error;
      return new Set(data as Permission[]);
    },
  });
  const set = query.data;
  return {
    loaded: !!set,
    // Team permissions: false until loaded.
    can: (permission: Permission) => !!set?.has(permission),
    // Member-side actions: allowed until we know the owner turned them off.
    memberCan: (permission: Permission) => !set || set.has(permission),
  };
}

export function useSetActiveGym() {
  return use(ActiveGymContext).setActiveSlug;
}

// Pending join ------------------------------------------------------------------
// A gym to join once the user is signed in: from a join link opened while
// signed out, or from the Play Store install referrer ("gym=<slug>").

const PENDING_JOIN_KEY = 'gymos.pendingJoin';
const REFERRER_CHECKED_KEY = 'gymos.referrerChecked';

export function setPendingJoin(slug: string) {
  localStorage.setItem(PENDING_JOIN_KEY, slug);
}

export function takePendingJoin(): string | null {
  const slug = localStorage.getItem(PENDING_JOIN_KEY);
  if (slug) localStorage.removeItem(PENDING_JOIN_KEY);
  return slug;
}

// Reads the Play Store install referrer once per install.
export async function checkInstallReferrer() {
  if (Platform.OS !== 'android' || localStorage.getItem(REFERRER_CHECKED_KEY)) return;
  localStorage.setItem(REFERRER_CHECKED_KEY, '1');
  try {
    const referrer = await Application.getInstallReferrerAsync();
    const gym = new URLSearchParams(referrer).get('gym');
    const slug = gym ? parseGymCode(gym) : null;
    if (slug) setPendingJoin(slug);
  } catch {
    // Not installed from Play (emulator, sideload): nothing to do.
  }
}
