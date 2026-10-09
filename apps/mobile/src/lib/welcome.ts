import './local-storage';

// Whether this install has seen the intro slides (app/welcome.tsx).
const KEY = 'gymos.welcomed';

export function hasSeenWelcome() {
  return localStorage.getItem(KEY) === '1';
}

export function markWelcomed() {
  localStorage.setItem(KEY, '1');
}
