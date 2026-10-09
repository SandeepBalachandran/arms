import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Shared primitives so every screen uses the same tokens (constants/theme.ts).

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'small' | 'error';

export function Text({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  const theme = useTheme();
  const color =
    variant === 'muted' || variant === 'small' ? theme.textSecondary : variant === 'error' ? theme.danger : theme.text;
  return <RNText style={[styles[variant], { color }, style]} {...props} />;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: PressableProps & { title: string; variant?: 'primary' | 'secondary'; loading?: boolean; style?: ViewProps['style'] }) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : { backgroundColor: theme.surface, borderColor: theme.text, borderWidth: 1 },
        (pressed || disabled || loading) && { opacity: 0.7 },
        style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.accentText : theme.text} />
      ) : (
        <RNText style={[styles.buttonText, { color: primary ? theme.accentText : theme.text }]}>{title}</RNText>
      )}
    </Pressable>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {label && <Text variant="small">{label}</Text>}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }, style]}
        {...props}
      />
    </View>
  );
}

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]} {...props} />;
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16 },
  muted: { fontSize: 15 },
  small: { fontSize: 13 },
  error: { fontSize: 14 },
  button: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  card: { borderWidth: 1, borderRadius: Radius, padding: Spacing.three, gap: Spacing.two },
});

// Round icon button (back, notifications) on a soft background.
export function IconButton({
  children,
  label,
  dot,
  style,
  ...props
}: PressableProps & { label: string; dot?: boolean; children: ReactNode; style?: ViewProps['style'] }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
        pressed && { opacity: 0.7 },
        style,
      ]}
      {...props}>
      {children}
      {dot && (
        <View
          style={{ position: 'absolute', top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: theme.accent, borderWidth: 1.5, borderColor: theme.surfaceMuted }}
        />
      )}
    </Pressable>
  );
}

// "Today Workouts (3)"-style section title with an optional link on the right.
export function SectionHeader({ title, count, action, onAction }: { title: string; count?: number; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: Spacing.one }}>
      <Text variant="heading">
        {title}
        {count !== undefined && <Text variant="muted"> ({count})</Text>}
      </Text>
      {action && (
        <Pressable onPress={onAction} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: theme.textSecondary, fontWeight: '600', fontSize: 14 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Small rounded label, e.g. "16 Workout".
export function Chip({ children, tone = 'outline' }: { children: ReactNode; tone?: 'outline' | 'accent' | 'hero' }) {
  const theme = useTheme();
  const look =
    tone === 'accent' ? { backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }
    : tone === 'hero' ? { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'transparent', color: theme.heroText }
    : { backgroundColor: 'transparent', borderColor: theme.border, color: theme.text };
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: look.backgroundColor, borderColor: look.borderColor }}>
      {typeof children === 'string' ? <RNText style={{ color: look.color, fontSize: 13, fontWeight: '600' }}>{children}</RNText> : children}
    </View>
  );
}
