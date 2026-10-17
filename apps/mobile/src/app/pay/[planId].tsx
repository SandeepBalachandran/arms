import { formatDuration, formatMoney, upiPayLink, utrSchema } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CircleAlert, Clock, Copy, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, Input, Loading, Screen, Text } from '@/components/ui';
import { Spacing, type Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { alertGymOfClaim, usePaymentClaims, usePlans } from '@/lib/memberships';
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
      <Notice icon={CircleAlert} tint="pink" title="Plan not available" text="This plan may have been changed or removed by the gym.">
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Notice>
    );
  }
  if (!gym.upi_id || gym.currency !== 'INR') {
    return (
      <Notice icon={CircleAlert} tint="yellow" title="UPI isn’t set up" text={`${gym.name} doesn’t take UPI in the app yet. Please pay at the front desk.`}>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Notice>
    );
  }
  if (claims.data?.pending) {
    return (
      <Notice
        icon={Clock}
        tint="yellow"
        title="A payment is already waiting"
        text={`${gym.name} hasn’t confirmed your earlier payment of ${formatMoney(claims.data.pending.amount_paise, gym.currency)} yet. You can start a new one after they confirm or reject it.`}>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Notice>
    );
  }

  const memberName = profile.data?.full_name || 'Member';
  const payee = gym.upi_payee_name ?? gym.name;
  const amount = formatMoney(plan.price_paise, gym.currency);
  const link = upiPayLink({
    upiId: gym.upi_id,
    payeeName: payee,
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
    const { data: paymentId, error } = await supabase.rpc('claim_upi_payment', {
      p_gym_id: gym!.id,
      p_plan_id: plan!.id,
      ...(parsedUtr.data ? { p_utr: parsedUtr.data } : {}),
    });
    setSubmitting(false);
    if (error) return setError(error.message);
    void alertGymOfClaim(paymentId);
    await queryClient.invalidateQueries({ queryKey: ['payment-claims'] });
    router.back();
  }

  return (
    <Screen>
      <View style={{ backgroundColor: theme.hero, borderRadius: 24, padding: 20, gap: 4 }}>
        <Text style={{ color: theme.heroMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {gym.name} · {plan.name}
        </Text>
        <Text style={{ color: theme.heroText, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 }}>{amount}</Text>
        <Text style={{ color: theme.heroMuted, fontSize: 13 }}>
          {formatDuration(plan.duration_days)} membership · paid straight to the gym, no gateway fee
        </Text>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
        <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 14, borderWidth: 1, borderColor: theme.border }}>
          <QRCode value={link} size={96} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="small">UPI ID</Text>
          <Text style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>
            {gym.upi_id}
          </Text>
          <Text variant="small" numberOfLines={1}>
            {payee}
          </Text>
          <Pressable
            onPress={copyUpiId}
            accessibilityRole="button"
            accessibilityLabel={copied ? 'UPI ID copied' : 'Copy UPI ID'}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: copied ? theme.tints.green.bg : theme.surfaceMuted,
              opacity: pressed ? 0.6 : 1,
            })}>
            {copied ? <Check size={14} color={theme.tints.green.fg} /> : <Copy size={14} color={theme.text} />}
            <Text style={{ fontSize: 13, fontWeight: '600', color: copied ? theme.tints.green.fg : theme.text }}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>
      </Card>

      <Step n={1} title={`Pay ${amount}`} done={opened}>
        <Button title="Open UPI app" variant="dark" onPress={openUpiApp} />
        <Text variant="small">
          Opens GPay, PhonePe or Paytm with the amount filled in. If it won’t open, pay the UPI ID above by hand, or scan
          the code from another phone.
        </Text>
      </Step>

      <Step n={2} title={`Tell ${gym.name}`}>
        <Input
          label="UPI reference number (optional)"
          value={utr}
          // UTRs are 12 digits: only digits go in, and no more than 12.
          onChangeText={(text) => setUtr(text.replace(/\D/g, '').slice(0, 12))}
          autoCorrect={false}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={12}
          placeholder="12-digit UTR from your UPI app"
        />
        {error && <Text variant="error">{error}</Text>}
        <Button title="I’ve paid" onPress={claim} loading={submitting} disabled={!opened && !utr} />
      </Step>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: Spacing.one }}>
        <ShieldCheck size={16} color={theme.textSecondary} style={{ marginTop: 2 }} />
        <Text variant="small" style={{ flex: 1 }}>
          Your membership starts once the gym confirms the payment reached them. Adding the reference number makes that
          faster.
        </Text>
      </View>
    </Screen>
  );
}

// A numbered step: a lime badge (a tick once done) beside its title.
function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? theme.tints.green.bg : theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          {done ? (
            <Check size={16} color={theme.tints.green.fg} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.accentText }}>{n}</Text>
          )}
        </View>
        <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

// Full-screen message for when payment can't go ahead.
function Notice({ icon: Icon, tint, title, text, children }: { icon: LucideIcon; tint: Tint; title: string; text: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 20 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.tints[tint].bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={26} color={theme.tints[tint].fg} />
        </View>
        <Text variant="heading" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        <Text variant="muted" style={{ textAlign: 'center' }}>
          {text}
        </Text>
      </Card>
      {children}
    </Screen>
  );
}
