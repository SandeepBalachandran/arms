import { useSyncExternalStore } from 'react';

// Web version of appearance.ts: react-native-web has no
// Appearance.setColorScheme, so the choice lives in a small store instead.

export type Scheme = 'light' | 'dark';

const KEY = 'gymos.theme';
const listeners = new Set<() => void>();

function stored(): Scheme {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

let current = stored();

export function setScheme(scheme: Scheme) {
  localStorage.setItem(KEY, scheme);
  current = scheme;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, () => current, () => 'light');
}
