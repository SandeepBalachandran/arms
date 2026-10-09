import { useState } from 'react';
import { z } from 'zod';

import { Button, Input, Screen, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// Default is passwordless: email → 6-digit code (new emails create an account;
// the Supabase "Magic Link" template must include {{ .Token }}). Accounts with a
// password (e.g. ones created from the web or the demo seed) can use it instead.
export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const parsed = z.email().safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setError('Enter a valid email');
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: parsed.data });
    setLoading(false);
    if (error) return setError(error.message);
    setEmail(parsed.data);
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
    <Screen>
      <Text variant="title" style={{ marginTop: 48 }}>
        GymOS
      </Text>
      <Text variant="muted">Your membership, check-ins, classes and workouts.</Text>

      {step === 'email' ? (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          {error && <Text variant="error">{error}</Text>}
          <Button title="Send code" onPress={sendCode} loading={loading} />
          <Button
            title="Sign in with password"
            variant="secondary"
            onPress={() => {
              setError(null);
              setStep('password');
            }}
          />
        </>
      ) : step === 'password' ? (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={signInWithPassword}
          />
          {error && <Text variant="error">{error}</Text>}
          <Button title="Sign in" onPress={signInWithPassword} loading={loading} disabled={!password} />
          <Button
            title="Email me a code instead"
            variant="secondary"
            onPress={() => {
              setError(null);
              setStep('email');
            }}
          />
        </>
      ) : (
        <>
          <Text variant="muted">We sent a 6-digit code to {email}.</Text>
          <Input
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={verify}
          />
          {error && <Text variant="error">{error}</Text>}
          <Button title="Sign in" onPress={verify} loading={loading} disabled={code.trim().length < 6} />
          <Button
            title="Use a different email"
            variant="secondary"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          />
        </>
      )}
    </Screen>
  );
}
