import './local-storage';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Release builds close the app on an uncaught JavaScript error and show
// nothing. Keep the last one on the phone so the next launch can show it
// (components/last-crash.tsx) and the member can send it to us.

const KEY = 'gymos.lastCrash';

export type CrashReport = {
  message: string;
  stack: string;
  fatal: boolean;
  at: string;
  device: string;
};

type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsType = { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void };

export function recordCrash(error: unknown, fatal: boolean) {
  const e = error instanceof Error ? error : new Error(String(error));
  const report: CrashReport = {
    message: `${e.name}: ${e.message}`,
    stack: (e.stack ?? '').slice(0, 3000),
    fatal,
    at: new Date().toISOString(),
    device: `${Platform.OS} ${Platform.Version} · app ${Constants.expoConfig?.version ?? '?'}`,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(report));
  } catch {
    // Nothing more we can do while crashing.
  }
}

export function readLastCrash(): CrashReport | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function clearLastCrash() {
  localStorage.removeItem(KEY);
}

let installed = false;

// Record uncaught errors, then let React Native handle them as usual.
export function installCrashRecorder() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsType }).ErrorUtils;
  if (installed || !errorUtils) return;
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    recordCrash(error, !!isFatal);
    previous(error, isFatal);
  });
}
