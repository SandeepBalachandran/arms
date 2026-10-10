// Member app palette: white and soft neutrals, a bright lime accent for
// primary actions, a dark olive for hero cards and the tab bar, and pastel
// tints for feature tiles. `brand` stays a darker lime so it reads as text.

export const Colors = {
  light: {
    text: '#111111',
    textSecondary: '#6b6b6b',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f4f5f1',
    border: '#ececea',
    brand: '#4d7c0f',
    brandText: '#ffffff',
    // Lime fill for primary buttons and highlights, with dark text on it.
    accent: '#c8f04b',
    accentText: '#141a04',
    // Dark hero cards, progress ring and the floating tab bar.
    hero: '#1f2a10',
    heroText: '#ffffff',
    heroMuted: '#c3cdb2',
    danger: '#dc2626',
    // Feature tiles: background tint and icon colour.
    tints: {
      blue: { bg: '#e2f3fb', fg: '#3d84a8' },
      green: { bg: '#e7f7e3', fg: '#4f9a57' },
      pink: { bg: '#f9e4f1', fg: '#b85d98' },
      yellow: { bg: '#fbf5d8', fg: '#a08a1c' },
    },
    progress: '#ecf9e2',
    // Data marks. Validated (dataviz validator) against both surfaces.
    chart: '#65a30d',
  },
  dark: {
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    background: '#0b0d08',
    surface: '#15180f',
    surfaceMuted: '#1c2015',
    border: '#2a2f22',
    brand: '#a3e635',
    brandText: '#1a2e05',
    accent: '#c8f04b',
    accentText: '#141a04',
    hero: '#1f2b0d',
    heroText: '#ffffff',
    heroMuted: '#b5c19f',
    danger: '#f87171',
    tints: {
      blue: { bg: '#12262f', fg: '#8cc9e6' },
      green: { bg: '#15281a', fg: '#8fd197' },
      pink: { bg: '#2c1626', fg: '#e3a2cc' },
      yellow: { bg: '#2a2510', fg: '#e0cb6a' },
    },
    progress: '#18240f',
    chart: '#65a30d',
  },
} as const;

export type ThemeColors = (typeof Colors)['light' | 'dark'];
export type Tint = keyof ThemeColors['tints'];

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const Radius = 20;

// Poppins, one file per weight (loaded in app/_layout.tsx). Android can't
// synthesise weights for a custom font, so pick the file instead of setting
// fontWeight. Text in components/ui.tsx does this from `fontWeight`.
export const Fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export function fontFor(weight?: string | number) {
  const w = weight === 'bold' ? 700 : Number(weight) || 400;
  if (w >= 800) return Fonts.extrabold;
  if (w >= 700) return Fonts.bold;
  if (w >= 600) return Fonts.semibold;
  if (w >= 500) return Fonts.medium;
  return Fonts.regular;
}
