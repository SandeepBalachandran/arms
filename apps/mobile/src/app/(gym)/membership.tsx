import { formatDuration, formatMoney, formatReceipt, PAYMENT_METHOD_LABELS } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MembershipCard } from '@/components/membership-card';
import { Button, Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
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
        <Text variant="title">Membership</Text>
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

        <Text variant="heading">Plans at {gym?.name}</Text>
        <Text variant="muted">
          {upiEnabled
            ? 'Pay by UPI here, or at the front desk.'
            : 'Pay at the front desk to start or renew your membership.'}
        </Text>
        {plans.data?.length === 0 && <Text variant="muted">Your gym hasn’t added plans yet.</Text>}
        {plans.data?.map((plan) => (
          <Card key={plan.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="heading">{plan.name}</Text>
              <Text variant="heading" style={{ color: theme.brand }}>
                {formatMoney(plan.price_paise, currency)}
              </Text>
            </View>
            <Text variant="muted">
              {formatDuration(plan.duration_days)}
              {plan.class_credits != null ? ` · ${plan.class_credits} classes` : ''}
            </Text>
            {plan.description && <Text variant="muted">{plan.description}</Text>}
            {upiEnabled && (
              <Button
                title={`Pay ${formatMoney(plan.price_paise, currency)} with UPI`}
                disabled={!!pending}
                onPress={() => router.push({ pathname: '/pay/[planId]', params: { planId: plan.id } })}
              />
            )}
          </Card>
        ))}

        {!!payments.data?.length && (
          <>
            <Text variant="heading">Receipts</Text>
            <Card style={{ gap: 0, paddingVertical: Spacing.one }}>
              {payments.data.map((p, i) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: Spacing.two,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: theme.border,
                  }}>
                  <View>
                    <Text>{p.subscriptions?.plan_name ?? 'Payment'}</Text>
                    <Text variant="small">
                      {formatReceipt(gym?.receipt_prefix ?? '', p.receipt_no)} · {new Date(p.paid_at!).toLocaleDateString('en-IN')} · {PAYMENT_METHOD_LABELS[p.method]}
                    </Text>
                  </View>
                  <Text>{formatMoney(p.amount_paise, currency)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
