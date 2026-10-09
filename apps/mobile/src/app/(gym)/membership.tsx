import { formatDuration, formatMoney, PAYMENT_METHOD_LABELS } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MembershipCard } from '@/components/membership-card';
import { Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useMyPayments, usePlans } from '@/lib/memberships';

export default function MembershipScreen() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const plans = usePlans();
  const payments = useMyPayments();
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

        <Text variant="heading">Plans at {gym?.name}</Text>
        <Text variant="muted">Pay at the front desk for now. Online payment is coming soon.</Text>
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
                      #{p.receipt_no} · {new Date(p.paid_at!).toLocaleDateString('en-IN')} · {PAYMENT_METHOD_LABELS[p.method]}
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
