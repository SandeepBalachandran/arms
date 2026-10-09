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
          ? { backgroundColor: theme.brand }
          : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
        (pressed || disabled || loading) && { opacity: 0.7 },
        style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.brandText : theme.text} />
      ) : (
        <RNText style={[styles.buttonText, { color: primary ? theme.brandText : theme.text }]}>{title}</RNText>
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
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16 },
  muted: { fontSize: 15 },
  small: { fontSize: 13 },
  error: { fontSize: 14 },
  button: {
    minHeight: 48,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  card: { borderWidth: 1, borderRadius: Radius, padding: Spacing.three, gap: Spacing.two },
});
