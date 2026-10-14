import { BRAND } from '@gymos/shared';
import { ArrowLeft, Dumbbell, KeyRound, Lock, Mail, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { InstallBanner } from '@/components/install-banner';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { readSplashBrand } from '@/lib/splash-brand';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'password' | 'code';

const COPY: Record<Step, { title: string; subtitle: string }> = {
  email: { title: 'Welcome', subtitle: 'Sign in or create an account. We’ll email you a 6-digit code.' },
  password: { title: 'Welcome back', subtitle: 'Sign in with your email and password.' },
  code: { title: 'Check your email', subtitle: 'Enter the 6-digit code we sent to' },
};

// Default is passwordless: email → 6-digit code (new emails create an account;
// the Supabase "Magic Link" template must include {{ .Token }}). Accounts with a
// password (e.g. ones created from the web or the demo seed) can use it instead.
export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [brand] = useState(readSplashBrand);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const copy = COPY[step];

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  async function sendCode() {
    const parsed = z.email().safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setError('Enter a valid email');
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: parsed.data });
    setLoading(false);
    if (error) return setError(error.message);
    setEmail(parsed.data);
    setCode('');
    setStep('code');
  }

  async function signInWithPassword() {
    const parsed = z.email().safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setError('Enter a valid email');
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setLoading(false);
    // On success the session changes and the navigator leaves this screen.
    if (error) setError(error.message);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.hero }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          <SafeAreaView edges={['top']}>
            <Hero brand={brand?.name} />
          </SafeAreaView>

          <View
            style={{
              flexGrow: 1,
              backgroundColor: theme.background,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: Spacing.four,
              paddingBottom: Math.max(insets.bottom, Spacing.three) + Spacing.three,
              gap: Spacing.three,
            }}>
            <Animated.View key={step} entering={reduced ? undefined : FadeInDown.duration(350)} style={{ gap: Spacing.three }}>
              <View style={{ gap: 4 }}>
                {step === 'code' && (
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.tints.green.bg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two }}>
                    <MailCheck size={24} color={theme.tints.green.fg} />
                  </View>
                )}
                <Text variant="title">{copy.title}</Text>
                <Text variant="muted">
                  {copy.subtitle}
                  {step === 'code' && <Text style={{ fontWeight: '600' }}> {email}</Text>}
                </Text>
              </View>

              {step !== 'code' && (
                <Segmented
                  value={step}
                  onChange={go}
                  options={[
                    { value: 'email', label: 'Email code', icon: Mail },
                    { value: 'password', label: 'Password', icon: KeyRound },
                  ]}
                />
              )}

              {step === 'code' ? (
                <Input
                  label="6-digit code"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={verify}
                  placeholder="••••••"
                  style={{ fontSize: 26, letterSpacing: 12, textAlign: 'center', minHeight: 62 }}
                />
              ) : (
                <Input
                  label="Email"
                  icon={Mail}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType={step === 'email' ? 'send' : 'next'}
                  onSubmitEditing={step === 'email' ? sendCode : undefined}
                />
              )}
              {step === 'password' && (
                <PasswordInput
                  label="Password"
                  icon={Lock}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={signInWithPassword}
                />
              )}

              {!!error && (
                <View style={{ borderRadius: 14, padding: Spacing.two + 4, backgroundColor: theme.tints.pink.bg }}>
                  <Text variant="error">{error}</Text>
                </View>
              )}

              {step === 'email' && <Button title="Send code" onPress={sendCode} loading={loading} />}
              {step === 'password' && <Button title="Sign in" onPress={signInWithPassword} loading={loading} disabled={!password} />}
              {step === 'code' && (
                <>
                  <Button title="Verify and sign in" onPress={verify} loading={loading} disabled={code.length < 6} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <LinkButton icon={ArrowLeft} title="Different email" onPress={() => go('email')} />
                    <LinkButton title="Resend code" onPress={sendCode} disabled={loading} />
                  </View>
                </>
              )}
            </Animated.View>

            <View style={{ flex: 1 }} />
            <InstallBanner />
            <Text variant="small" style={{ textAlign: 'center' }}>
              {step === 'password'
                ? 'Forgot your password? Use Email code instead.'
                : 'New here? Use your email and your account is created for you.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Dark band with the logo (brand.ts), the remembered gym and some lime shapes.
function Hero({ brand }: { brand?: string }) {
  const theme = useTheme();
  return (
    <View style={{ height: 230, paddingHorizontal: Spacing.four, justifyContent: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: -60, top: -40, width: 220, height: 220, borderRadius: 110, borderWidth: 28, borderColor: 'rgba(200,240,75,0.10)' }} />
      <View style={{ position: 'absolute', right: 150, top: 46, width: 14, height: 14, borderRadius: 7, backgroundColor: theme.accent }} />
      <View style={{ position: 'absolute', right: 80, top: 34, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(200,240,75,0.5)' }} />

      <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }}>
        <Dumbbell size={28} color={theme.accentText} strokeWidth={2.4} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: Spacing.three }} accessibilityRole="header" accessibilityLabel={BRAND.name}>
        <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1.2, color: '#ffffff', lineHeight: 46 }}>{BRAND.logo[0]}</Text>
        <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1.2, color: theme.accent, lineHeight: 46 }}>{BRAND.logo[1]}</Text>
      </View>
      <Text style={{ color: theme.heroMuted, fontSize: 14 }} numberOfLines={1}>
        {brand ? `Your ${brand} membership, in your pocket` : 'Membership, check-ins, classes and workouts'}
      </Text>
    </View>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: typeof Mail }[];
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: theme.surfaceMuted }}>
      {options.map(({ value: v, label, icon: Icon }) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 42,
              borderRadius: 999,
              backgroundColor: active ? theme.hero : 'transparent',
            }}>
            <Icon size={16} color={active ? theme.accent : theme.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: active ? theme.heroText : theme.textSecondary }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LinkButton({ title, icon: Icon, onPress, disabled }: { title: string; icon?: typeof Mail; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, opacity: pressed || disabled ? 0.5 : 1 })}>
      {!!Icon && <Icon size={16} color={theme.brand} />}
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.brand }}>{title}</Text>
    </Pressable>
  );
}
