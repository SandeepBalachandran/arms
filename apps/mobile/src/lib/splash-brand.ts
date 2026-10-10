// The last gym the app showed, so the splash can greet members with their
// gym's name and logo before anything has loaded. Cleared on sign-out.
const KEY = 'gymos.splashGym';

export type SplashBrand = { name: string; logo_url: string | null };

export function readSplashBrand(): SplashBrand | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveSplashBrand(brand: SplashBrand | null) {
  if (brand) localStorage.setItem(KEY, JSON.stringify(brand));
  else localStorage.removeItem(KEY);
}
