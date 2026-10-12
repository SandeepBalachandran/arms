import { formatDuration, formatMoney, formatReceipt, PAYMENT_METHOD_LABELS } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChevronRight, ReceiptText, Sparkles } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MembershipCard } from '@/components/membership-card';
import { PtSection } from '@/components/pt-section';
import { Appear } from '@/components/motion';
import { Button, Card, SectionHeader, Text } from '@/components/ui';
import { Spacing, type Tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useMyPayments, usePaymentClaims, usePlans } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

export default function MembershipScreen() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const plans = usePlans();
  const payments = useMyPayments();
  const claims = usePaymentClaims();
  const router = useRouter();
  // In-app UPI needs a UPI ID and an INR gym (both set in the web admin).
  const upiEnabled = !!gym?.upi_id && gym.currency === 'INR';
  const pending = claims.data?.pending;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const currency = gym?.currency ?? 'INR';
  // Cheapest per day among plans of different lengths gets a "Best value" tag.
  const perDay = (plans.data ?? []).map((p) => ({ id: p.id, rate: p.price_paise / Math.max(1, p.duration_days), days: p.duration_days }));
  const bestValue =
    new Set(perDay.map((p) => p.days)).size > 1 ? perDay.reduce((a, b) => (b.rate < a.rate ? b : a)).id : null;

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.brand} />}>
        <Appear index={0}>
          <Text variant="title">Membership</Text>
        </Appear>
        <MembershipCard />

        {pending && (
          <Card style={{ borderColor: theme.brand }}>
            <Text variant="small">Waiting for {gym?.name} to confirm</Text>
            <Text variant="heading">
              {formatMoney(pending.amount_paise, currency)} · {pending.plans?.name}
            </Text>
            <Text variant="muted">
              Sent {new Date(pending.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              {pending.utr ? ` · Ref ${pending.utr}` : ''}. Your membership starts when they confirm.
            </Text>
            <Button
              title="Withdraw (payment didn’t go through)"
              variant="secondary"
              onPress={async () => {
                await supabase.rpc('withdraw_upi_payment', { p_payment_id: pending.id });
                claims.refetch();
              }}
            />
          </Card>
        )}
        {claims.data?.rejected.map((p) => (
          <Card key={p.id} style={{ borderColor: theme.danger }}>
            <Text variant="small">Payment not confirmed</Text>
            <Text variant="heading">
              {formatMoney(p.amount_paise, currency)} · {p.plans?.name}
            </Text>
            <Text variant="muted">{p.note ?? 'The gym couldn’t find this payment.'} Contact the front desk if you were charged.</Text>
          </Card>
        ))}

        <SectionHeader title="Plans" />
        <Text variant="muted" style={{ marginTop: -8 }}>
          {upiEnabled ? 'Pay by UPI here, or at the front desk.' : 'Pay at the front desk to start or renew.'}
        </Text>
        {plans.data?.length === 0 && <Text variant="muted">Your gym hasn’t added plans yet.</Text>}
        {plans.data?.map((plan, i) => (
          <Appear key={plan.id} index={i}>
            <PlanCard
              plan={plan}
              currency={currency}
              best={plan.id === bestValue}
              tint={PLAN_TINTS[i % PLAN_TINTS.length]}
              onPay={upiEnabled ? () => router.push({ pathname: '/pay/[planId]', params: { planId: plan.id } }) : undefined}
              payDisabled={!!pending}
            />
          </Appear>
        ))}

        <PtSection />

        {!!payments.data?.length && (
          <>
            <SectionHeader title="Receipts" count={payments.data.length} />
            <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
              {payments.data.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: p.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Receipt ${formatReceipt(gym?.receipt_prefix ?? '', p.receipt_no)}, ${formatMoney(p.amount_paise, currency)}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: theme.border, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.tints.green.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <ReceiptText size={18} color={theme.tints.green.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }} numberOfLines={1}>
                      {p.pt_subscriptions ? `PT: ${p.pt_subscriptions.package_name}` : (p.subscriptions?.plan_name ?? 'Payment')}
                    </Text>
                    <Text variant="small">
                      {new Date(p.paid_at!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {PAYMENT_METHOD_LABELS[p.method]} · {formatReceipt(gym?.receipt_prefix ?? '', p.receipt_no)}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '700' }}>{formatMoney(p.amount_paise, currency)}</Text>
                  <ChevronRight size={18} color={theme.textSecondary} />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const PLAN_TINTS: Tint[] = ['green', 'blue', 'pink', 'yellow'];

type Plan = NonNullable<ReturnType<typeof usePlans>['data']>[number];

function PlanCard({ plan, currency, best, tint, onPay, payDisabled }: {
  plan: Plan;
  currency: string;
  best: boolean;
  tint: Tint;
  onPay?: () => void;
  payDisabled: boolean;
}) {
  const theme = useTheme();
  const months = Math.round(plan.duration_days / 30);
  const price = formatMoney(plan.price_paise, currency);
  // Compact row: what and how long on the left, price and Pay on the right.
  return (
    <Card style={[{ padding: 16, gap: 6 }, best && { borderColor: theme.brand, borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{plan.name}</Text>
            {best && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: theme.accent }}>
                <Sparkles size={10} color={theme.accentText} />
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.accentText }}>Best value</Text>
              </View>
            )}
          </View>
          <Text variant="small">
            {formatDuration(plan.duration_days)}
            {plan.class_credits != null ? ` · ${plan.class_credits} classes` : ''}
            {months > 1 ? ` · ≈ ${formatMoney(Math.round(plan.price_paise / months / 100) * 100, currency)}/month` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: '800' }}>{price}</Text>
          {onPay && (
            <Pressable
              onPress={onPay}
              disabled={payDisabled}
              accessibilityRole="button"
              accessibilityLabel={`Pay ${price} with UPI`}
              style={({ pressed }) => ({ backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed || payDisabled ? 0.5 : 1 })}>
              <Text style={{ color: theme.accentText, fontWeight: '800', fontSize: 13 }}>Pay with UPI</Text>
            </Pressable>
          )}
        </View>
      </View>
      {plan.description && <Text variant="small">{plan.description}</Text>}
    </Card>
  );
}
