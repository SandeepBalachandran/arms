import './local-storage';

import { Appearance, useColorScheme } from 'react-native';

// The user's theme choice: light by default, dark if they pick it. Forcing it
// through Appearance makes useColorScheme(), native alerts, pickers and the
// keyboard all follow the app's choice instead of the phone's setting.

export type Scheme = 'light' | 'dark';

const KEY = 'gymos.theme';

function stored(): Scheme {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

// Apply before the first render so there is no flash of the wrong theme.
Appearance.setColorScheme(stored());

export function setScheme(scheme: Scheme) {
  localStorage.setItem(KEY, scheme);
  Appearance.setColorScheme(scheme);
}

export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}
