// Same palette as apps/web (globals.css): neutral zinc with a lime brand.

export const Colors = {
  light: {
    text: '#18181b',
    textSecondary: '#71717a',
    background: '#fafafa',
    surface: '#ffffff',
    border: '#e4e4e7',
    brand: '#65a30d',
    brandText: '#ffffff',
    danger: '#dc2626',
  },
  dark: {
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    background: '#09090b',
    surface: '#18181b',
    border: '#27272a',
    brand: '#a3e635',
    brandText: '#1a2e05',
    danger: '#f87171',
  },
} as const;

export type ThemeColors = (typeof Colors)['light' | 'dark'];

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const Radius = 12;
