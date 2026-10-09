import { formatDuration, formatMoney, upiPayLink, utrSchema } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Button, Card, Input, Loading, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { usePaymentClaims, usePlans } from '@/lib/memberships';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

// Pay the gym's UPI ID from any UPI app, then tell the gym. The payment shows
// as "waiting for confirmation" until staff check it in their UPI app.
export default function PayScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const membership = useActiveGym();
  const plans = usePlans();
  const claims = usePaymentClaims();
  const profile = useProfile();
  const [utr, setUtr] = useState('');
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const gym = membership?.gym;
  const plan = plans.data?.find((p) => p.id === planId);
  if (plans.isPending || claims.isPending) return <Loading />;
  if (!gym || !plan) {
    return (
      <Screen>
        <Text variant="heading">Plan not available</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!gym.upi_id || gym.currency !== 'INR') {
    return (
      <Screen>
        <Text variant="heading">UPI isn’t set up</Text>
        <Text variant="muted">{gym.name} doesn’t take UPI in the app yet. Please pay at the front desk.</Text>
      </Screen>
    );
  }
  if (claims.data?.pending) {
    return (
      <Screen>
        <Text variant="heading">A payment is already waiting</Text>
        <Text variant="muted">
          {gym.name} hasn’t confirmed your earlier payment of {formatMoney(claims.data.pending.amount_paise, gym.currency)} yet.
          You can start a new one after they confirm or reject it.
        </Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const memberName = profile.data?.full_name || 'Member';
  const link = upiPayLink({
    upiId: gym.upi_id,
    payeeName: gym.upi_payee_name ?? gym.name,
    amountPaise: plan.price_paise,
    note: `${plan.name} - ${memberName}`,
  });

  async function openUpiApp() {
    setError(null);
    try {
      await Linking.openURL(link);
      setOpened(true);
    } catch {
      setError('No UPI app found. Pay to the UPI ID above from any UPI app.');
      setOpened(true);
    }
  }

  async function copyUpiId() {
    await Clipboard.setStringAsync(gym!.upi_id!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function claim() {
    const parsedUtr = utrSchema.safeParse(utr);
    if (!parsedUtr.success) return setError(parsedUtr.error.issues[0].message);
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.rpc('claim_upi_payment', {
      p_gym_id: gym!.id,
      p_plan_id: plan!.id,
      ...(parsedUtr.data ? { p_utr: parsedUtr.data } : {}),
    });
    setSubmitting(false);
    if (error) return setError(error.message);
    await queryClient.invalidateQueries({ queryKey: ['payment-claims'] });
    router.back();
  }

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: Spacing.four }}>
        <Text variant="muted">
          {plan.name} · {formatDuration(plan.duration_days)}
        </Text>
        <Text style={{ fontSize: 40, fontWeight: '700' }}>{formatMoney(plan.price_paise, gym.currency)}</Text>
      </Card>

      <Card>
        <Text variant="small">Pay to</Text>
        <Text variant="heading">{gym.upi_payee_name ?? gym.name}</Text>
        <Pressable onPress={copyUpiId} accessibilityHint="Copies the UPI ID">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'monospace' }}>{gym.upi_id}</Text>
            <Text style={{ color: theme.brand, fontWeight: '600' }}>{copied ? 'Copied' : 'Copy'}</Text>
          </View>
        </Pressable>
      </Card>

      <Text variant="heading">1. Pay</Text>
      <Button title="Open UPI app" onPress={openUpiApp} variant={opened ? 'secondary' : 'primary'} />
      <Text variant="small">
        If your UPI app won’t accept the link, pay {formatMoney(plan.price_paise, gym.currency)} to the UPI ID above
        manually.
      </Text>

      <Text variant="heading">2. Tell {gym.name}</Text>
      <Input
        label="UPI reference number (optional)"
        value={utr}
        onChangeText={setUtr}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
        placeholder="12-digit UTR from your UPI app"
      />
      {error && <Text variant="error">{error}</Text>}
      <Button title="I’ve paid" onPress={claim} loading={submitting} disabled={!opened && !utr} />
      <Text variant="small">
        Your membership starts once the gym confirms the payment reached them. Adding the reference number makes that
        faster.
      </Text>
    </Screen>
  );
}
