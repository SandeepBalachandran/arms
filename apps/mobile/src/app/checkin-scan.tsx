import { asCheckinResult, formatDate, parsePosterCode, type CheckinResult } from '@gymos/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { CircleCheck, MapPin, TriangleAlert } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { supabase } from '@/lib/supabase';

type Outcome = { result?: CheckinResult & { gym_name?: string }; error?: string };

// Member scans the gym's check-in poster. If the gym asks for it, the phone's
// location goes along so the server can tell they're at the gym.
export default function PosterScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const gym = useActiveGym()?.gym;
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [status, setStatus] = useState<string>();
  const busy = useRef(false);

  if (!permission) return <Loading />;
  if (!permission.granted) {
    return (
      <Screen>
        <Text variant="title">Scan to check in</Text>
        <Text variant="muted">Allow the camera to scan the check-in poster at your gym.</Text>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  async function position() {
    if (!gym?.checkin_location_required) return null;
    setStatus('Checking you’re at the gym…');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null; // the server explains location is needed
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return pos.coords;
  }

  async function onScan(data: string) {
    const code = parsePosterCode(data);
    if (busy.current || outcome || !code) return;
    busy.current = true;
    try {
      const coords = await position().catch(() => null);
      setStatus('Checking in…');
      const { data: res, error } = await supabase.rpc('poster_check_in', {
        p_slug: code.slug,
        p_key: code.key,
        ...(coords ? { p_lat: coords.latitude, p_lng: coords.longitude, p_accuracy_m: coords.accuracy ?? undefined } : {}),
      });
      setOutcome(error ? { error: error.message } : { result: asCheckinResult(res) as Outcome['result'] });
      if (!error) queryClient.invalidateQueries({ queryKey: ['visits'] });
    } finally {
      setStatus(undefined);
      busy.current = false;
    }
  }

  const result = outcome?.result;
  const ok = !!result;
  const color = outcome?.error ? theme.danger : result?.membership_ok ? theme.brand : '#d97706';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={outcome || status ? undefined : ({ data }) => onScan(data)}
      />
      {/* Viewfinder */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: 240, height: 240, borderRadius: 32, borderWidth: 4, borderColor: theme.accent }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end', padding: Spacing.three, paddingBottom: 40 }}>
        {outcome ? (
          <Card style={{ borderColor: color, borderWidth: 2, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {ok ? <CircleCheck size={28} color={color} /> : <TriangleAlert size={28} color={color} />}
              <Text variant="heading" style={{ color, flex: 1 }}>
                {outcome.error ?? (result!.duplicate ? 'You’re already checked in' : `Checked in at ${result!.gym_name ?? gym?.name}`)}
              </Text>
            </View>
            {result && (
              <Text variant="muted">
                {result.membership_ok
                  ? `Membership active till ${formatDate(result.ends_on!)}. Have a great workout!`
                  : result.ends_on
                    ? `Your membership ended on ${formatDate(result.ends_on)}. Please renew at the front desk.`
                    : 'You don’t have a plan yet. Pick one at the front desk.'}
              </Text>
            )}
            {ok ? (
              <Button title="Done" onPress={() => router.back()} />
            ) : (
              <Button title="Try again" onPress={() => setOutcome(null)} />
            )}
          </Card>
        ) : (
          <Card style={{ gap: 6 }}>
            <Text variant="heading">{status ?? 'Point at the gym’s check-in poster'}</Text>
            {gym?.checkin_location_required && !status && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color={theme.textSecondary} />
                <Text variant="small">Your location is checked once, only to confirm you’re at the gym.</Text>
              </View>
            )}
          </Card>
        )}
      </View>
    </View>
  );
}
