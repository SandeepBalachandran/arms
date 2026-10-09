import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, Screen, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useCheckinToken, useMyVisits } from '@/lib/checkins';
import { useActiveGym } from '@/lib/gyms';
import { useProfile } from '@/lib/profile';

// Member's check-in QR. The code changes every minute so a screenshot can't
// be reused; front-desk staff scan it from the app or a webcam.
export default function CheckinQrScreen() {
  const theme = useTheme();
  const gym = useActiveGym()?.gym;
  const profile = useProfile();
  const token = useCheckinToken();
  const visits = useMyVisits();
  const queryClient = useQueryClient();

  // Notice the scan: refresh visits while the code is on screen.
  useEffect(() => {
    const id = setInterval(() => queryClient.invalidateQueries({ queryKey: ['visits'] }), 5000);
    return () => clearInterval(id);
  }, [queryClient]);

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
        <Text variant="heading">{profile.data?.full_name || 'Member'}</Text>
        <Text variant="muted">{gym?.name}</Text>
        <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, minHeight: 252, justifyContent: 'center' }}>
          {token.data ? (
            <QRCode value={token.data} size={220} />
          ) : token.error ? (
            <Text variant="error" style={{ width: 220 }}>
              {token.error.message}
            </Text>
          ) : (
            <ActivityIndicator color={theme.brand} />
          )}
        </View>
        {visits.todayVisit ? (
          <Text variant="heading" style={{ color: theme.brand }}>
            Checked in ✓
          </Text>
        ) : (
          <Text variant="muted">Show this at the front desk</Text>
        )}
        <Text variant="small">The code refreshes every minute.</Text>
      </Card>
    </Screen>
  );
}
