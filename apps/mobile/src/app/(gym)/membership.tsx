import { formatDuration, formatMoney, formatReceipt, PAYMENT_METHOD_LABELS } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { CalendarRange, ReceiptText, Sparkles } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
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
                <View
                  key={p.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: theme.border }}>
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
                </View>
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
  const colors = theme.tints[tint];
  const months = Math.round(plan.duration_days / 30);
  return (
    <Card style={[{ padding: 18, gap: 12 }, best && { borderColor: theme.brand, borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <CalendarRange size={22} color={colors.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{plan.name}</Text>
          <Text variant="small">
            {formatDuration(plan.duration_days)}
            {plan.class_credits != null ? ` · ${plan.class_credits} classes` : ''}
          </Text>
        </View>
        {best && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.accent }}>
            <Sparkles size={12} color={theme.accentText} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accentText }}>Best value</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{formatMoney(plan.price_paise, currency)}</Text>
        {months > 1 && (
          <Text variant="small">≈ {formatMoney(Math.round(plan.price_paise / months / 100) * 100, currency)} / month</Text>
        )}
      </View>
      {plan.description && <Text variant="muted">{plan.description}</Text>}
      {onPay && <Button title={`Pay ${formatMoney(plan.price_paise, currency)} with UPI`} disabled={payDisabled} onPress={onPay} />}
    </Card>
  );
}
