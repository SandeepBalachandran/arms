import { formatDate } from '@gymos/shared';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Point = { day: string; value: number };

const HEIGHT = 170;
const PAD = { top: 16, right: 44, bottom: 22, left: 8 };

// Single-series line over time (dataviz spec: 2px line, 8px markers with a
// surface ring, recessive grid, direct label on the latest value only, tap a
// point to read it). No legend: the card title names the series.
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;
  const t0 = Date.parse(points[0].day);
  const t1 = Date.parse(points[points.length - 1].day);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (day: string) => PAD.left + (t1 === t0 ? plotW / 2 : ((Date.parse(day) - t0) / (t1 - t0)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;
  const coords = points.map((p) => ({ ...p, cx: x(p.day), cy: y(p.value) }));
  const last = coords[coords.length - 1];
  const active = selected !== null ? coords[selected] : null;
  const fmt = (v: number) => `${Number(v.toFixed(1))} ${unit}`;

  function onPress(locationX: number) {
    let nearest = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.cx - locationX) < Math.abs(coords[nearest].cx - locationX)) nearest = i;
    });
    setSelected(nearest === selected ? null : nearest);
  }

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Text variant="small" style={{ minHeight: 20 }}>
        {active ? `${formatDate(active.day)} · ${fmt(active.value)}` : 'Tap the chart to see a day'}
      </Text>
      {width > 0 && (
        <Pressable
          onPress={(e) => onPress(e.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel={`${unit} chart, ${points.length} entries, latest ${fmt(last.value)}`}>
          <Svg width={width} height={HEIGHT}>
            {[rawMin, rawMax].map((v) => (
              <Line
                key={v}
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(v)}
                y2={y(v)}
                stroke={theme.border}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}
            {rawMax !== rawMin && (
              <SvgText x={width - 4} y={y(rawMax) + 4} fontSize={11} fontFamily={Fonts.regular} fill={theme.textSecondary} textAnchor="end">
                {Number(rawMax.toFixed(1))}
              </SvgText>
            )}
            <SvgText x={width - 4} y={y(rawMin) + 4} fontSize={11} fontFamily={Fonts.regular} fill={theme.textSecondary} textAnchor="end">
              {Number(rawMin.toFixed(1))}
            </SvgText>
            {active && (
              <Line x1={active.cx} x2={active.cx} y1={PAD.top} y2={PAD.top + plotH} stroke={theme.textSecondary} strokeWidth={1} />
            )}
            {coords.length > 1 && (
              <Polyline
                points={coords.map((c) => `${c.cx},${c.cy}`).join(' ')}
                fill="none"
                stroke={theme.chart}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {coords.map((c, i) => (
              <Circle
                key={c.day}
                cx={c.cx}
                cy={c.cy}
                r={i === selected ? 6 : 4}
                fill={theme.chart}
                stroke={theme.surface}
                strokeWidth={2}
              />
            ))}
            <SvgText
              x={Math.min(last.cx, PAD.left + plotW)}
              y={last.cy - 10}
              fontSize={12}
              fontWeight="600"
              fill={theme.text}
              textAnchor="end">
              {fmt(last.value)}
            </SvgText>
            <SvgText x={PAD.left} y={HEIGHT - 4} fontSize={11} fontFamily={Fonts.regular} fill={theme.textSecondary}>
              {formatDate(points[0].day)}
            </SvgText>
            {points.length > 1 && (
              <SvgText x={PAD.left + plotW} y={HEIGHT - 4} fontSize={11} fontFamily={Fonts.regular} fill={theme.textSecondary} textAnchor="end">
                {formatDate(last.day)}
              </SvgText>
            )}
          </Svg>
        </Pressable>
      )}
    </View>
  );
}
