import { Eye as EyeIcon, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
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
  type TextStyle,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, fontFor, Radius, Spacing } from '@/constants/theme';
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
  // Swap fontWeight for the matching Poppins file (see fontFor).
  const { fontWeight, ...flat }: TextStyle = StyleSheet.flatten([styles[variant], { color }, style]);
  return <RNText style={{ ...flat, fontFamily: flat.fontFamily ?? fontFor(fontWeight) }} {...props} />;
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

export function Input({
  label,
  icon: Icon,
  trailing,
  style,
  ...props
}: TextInputProps & { label?: string; icon?: LucideIcon; trailing?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {!!label && <Text variant="small">{label}</Text>}
      <View>
        <TextInput
          // The visible label is separate text, so name the field for screen readers.
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, fontFamily: Fonts.regular },
            !!Icon && { paddingLeft: 46 },
            !!trailing && { paddingRight: 52 },
            style,
          ]}
          {...props}
        />
        {!!Icon && (
          <View pointerEvents="none" style={[styles.inputSide, { left: 16 }]}>
            <Icon size={18} color={theme.textSecondary} />
          </View>
        )}
        {!!trailing && <View style={[styles.inputSide, { right: 6 }]}>{trailing}</View>}
      </View>
    </View>
  );
}

// Password field with an eye button to show or hide what's typed.
export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'> & { label?: string; icon?: LucideIcon }) {
  const theme = useTheme();
  const [shown, setShown] = useState(false);
  const Eye = shown ? EyeOff : EyeIcon;
  return (
    <Input
      {...props}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setShown((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          hitSlop={6}
          style={({ pressed }) => [styles.eye, pressed && { backgroundColor: theme.surfaceMuted }]}>
          <Eye size={20} color={theme.textSecondary} />
        </Pressable>
      }
    />
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
  buttonText: { fontSize: 16, fontFamily: Fonts.bold },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  inputSide: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  eye: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
      {typeof children === 'string' ? <RNText style={{ color: look.color, fontSize: 13, fontFamily: Fonts.semibold }}>{children}</RNText> : children}
    </View>
  );
}
