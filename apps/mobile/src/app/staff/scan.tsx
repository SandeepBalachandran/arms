import { asCheckinResult, formatDate, isCheckinToken, type CheckinResult } from '@gymos/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Outcome = { result?: CheckinResult; error?: string };

// Front-desk mode: point the phone at a member's QR code. Never blocks entry;
// an inactive membership is shown as a reminder.
export default function StaffScanScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const busy = useRef(false);

  if (!permission) return <Loading />;
  if (!permission.granted) {
    return (
      <Screen>
        <Text variant="heading">Camera access needed</Text>
        <Text variant="muted">Allow the camera to scan members’ check-in codes.</Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  async function onScan(data: string) {
    if (busy.current || outcome || !isCheckinToken(data)) return;
    busy.current = true;
    const { data: res, error } = await supabase.rpc('check_in_by_token', { p_token: data });
    setOutcome(error ? { error: error.message } : { result: asCheckinResult(res) });
    busy.current = false;
  }

  const result = outcome?.result;
  const color = outcome?.error ? theme.danger : result?.membership_ok ? theme.brand : '#f59e0b';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={outcome ? undefined : ({ data }) => onScan(data)}
      />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: Spacing.three }}>
        {outcome ? (
          <Card style={{ borderColor: color, borderWidth: 2 }}>
            {outcome.error ? (
              <Text variant="heading" style={{ color }}>
                {outcome.error}
              </Text>
            ) : (
              result && (
                <>
                  <Text variant="title">{result.full_name || 'Member'}</Text>
                  <Text variant="heading" style={{ color }}>
                    {result.duplicate ? 'Already checked in' : 'Checked in ✓'}
                  </Text>
                  <Text variant="muted">
                    {result.membership_ok
                      ? `Membership active till ${formatDate(result.ends_on!)}`
                      : result.ends_on
                        ? `Membership expired ${formatDate(result.ends_on)} — remind them to renew`
                        : 'No membership yet — remind them to pick a plan'}
                  </Text>
                </>
              )
            )}
            <Button title="Scan next" onPress={() => setOutcome(null)} />
          </Card>
        ) : (
          <Card>
            <Text variant="heading">Scan a member’s QR code</Text>
            <Text variant="muted">Members open Home → Show my QR code.</Text>
          </Card>
        )}
      </View>
    </View>
  );
}
