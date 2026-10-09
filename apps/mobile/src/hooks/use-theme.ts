import { Colors } from '@/constants/theme';
import { useScheme } from '@/lib/appearance';

export function useTheme() {
  return Colors[useScheme()];
}
