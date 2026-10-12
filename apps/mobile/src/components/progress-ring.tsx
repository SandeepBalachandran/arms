import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useCountUp } from '@/components/motion';
import { Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

// Dark disc with a lime arc for `value` (0–1) that sweeps in on mount, and a
// short label in the middle.
export function ProgressRing({ value, label, caption, size = 64, warn }: { value: number; label: string; caption?: string; size?: number; warn?: boolean }) {
  const theme = useTheme();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useCountUp(Math.max(0, Math.min(1, value)), 1100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r + stroke / 2} fill={theme.hero} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" />
        {v > 0.001 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={warn ? '#f59e0b' : theme.accent}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <Text style={{ color: theme.heroText, fontWeight: '800', fontSize: caption ? size / 3.6 : size / 4.4, lineHeight: caption ? size / 3 : undefined }}>{label}</Text>
      {caption && <Text style={{ color: theme.heroMuted, fontSize: 11 }}>{caption}</Text>}
    </View>
  );
}
