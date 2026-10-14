import { useEffect } from 'react';

// On the web the member app and the admin share one site and one sign-in.
// Accounts on a gym's team belong in the admin; to use the member app, sign out
// and sign in with a member account.
export function useLandOnAdmin(isTeam: boolean, enabled: boolean) {
  useEffect(() => {
    if (enabled && isTeam) window.location.replace('/admin');
  }, [enabled, isTeam]);
}
