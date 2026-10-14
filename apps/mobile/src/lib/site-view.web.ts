import { usePathname } from 'expo-router';
import { useEffect } from 'react';

// On the web the member app and the admin share one site and one sign-in.
// People on a gym's team open the admin first; "Open the member app" in the
// admin (/switch/member) leaves a cookie so they stay here.

const VIEW_COOKIE = 'gos_view';

const wantsMember = () => document.cookie.split('; ').some((c) => c === `${VIEW_COOKIE}=member`);

// Sends the signed-in team member to the admin when the app opens at its home.
export function useLandOnAdmin(isTeam: boolean, enabled: boolean) {
  const pathname = usePathname();
  useEffect(() => {
    if (enabled && isTeam && pathname === '/' && !wantsMember()) window.location.replace('/switch/admin');
  }, [enabled, isTeam, pathname]);
}

export const openAdmin: (() => void) | null = () => window.location.assign('/switch/admin');
