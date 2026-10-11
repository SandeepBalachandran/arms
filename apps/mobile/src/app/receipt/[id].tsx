import { receiptHtml, receiptText } from '@gymos/shared';
import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { BadgeCheck, FileDown, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GymLogo } from '@/components/gym-badge';
import { Appear, PressableScale } from '@/components/motion';
import { Card, Loading, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveGym } from '@/lib/gyms';
import { useReceipt } from '@/lib/memberships';

// A member's receipt for one payment: what, when, how much. Share it as a PDF
// (or print on the web) or as a WhatsApp message.
export default function ReceiptScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gym = useActiveGym()?.gym;
  const receipt = useReceipt(id);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string>();

  if (receipt.isPending || !gym) return <Loading />;
  if (receipt.error) {
    return (
      <View style={{ flex: 1, padding: Spacing.three, backgroundColor: theme.background }}>
        <Text variant="error">Couldn’t load this receipt. {receipt.error.message}</Text>
      </View>
    );
  }
  const v = receipt.data;

  async function sharePdf() {
    setError(undefined);
    setSharing(true);
    try {
      const html = receiptHtml(v);
      if (Platform.OS === 'web') {
        // The browser's print dialog also offers "Save as PDF".
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
        win?.print();
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Receipt ${v.number}` });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t share the receipt.');
    } finally {
      setSharing(false);
    }
  }

  const rows: [string, string | null][] = [
    ['Date', v.paidOn],
    ['Received from', v.memberName],
    ['For', v.what],
    ['Valid', v.period],
    ['Sessions', v.sessions],
    ['Paid by', v.method],
    ['Reference', v.reference],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}>
        <Appear index={0}>
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }} accessibilityLabel={`Receipt ${v.number}, ${v.amount}, paid ${v.paidOn}`}>
            <View style={{ backgroundColor: theme.hero, padding: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <GymLogo gym={gym} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.heroText, fontWeight: '800', fontSize: 17 }} numberOfLines={1}>{v.gymName}</Text>
                  {v.gymPhone && <Text style={{ color: theme.heroMuted, fontSize: 13 }}>{v.gymPhone}</Text>}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: theme.heroMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>RECEIPT {v.number}</Text>
                  <Text style={{ color: theme.heroText, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>{v.amount}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <BadgeCheck size={14} color={theme.accentText} />
                  <Text style={{ color: theme.accentText, fontWeight: '800', fontSize: 12 }}>PAID</Text>
                </View>
              </View>
            </View>

            <View style={{ padding: 20, gap: 0 }}>
              {rows.filter(([, value]) => value).map(([label, value], i) => (
                <View key={label} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: theme.border }}>
                  <Text variant="small" style={{ width: 110 }}>{label}</Text>
                  <Text style={{ flex: 1, fontWeight: '600' }}>{value}</Text>
                </View>
              ))}
              {v.gymAddress && <Text variant="small" style={{ marginTop: 12 }}>{v.gymAddress}</Text>}
              <Text variant="muted" style={{ textAlign: 'center', marginTop: 16 }}>Thank you!</Text>
            </View>
          </Card>
        </Appear>

        <Appear index={1} style={{ gap: 10 }}>
          <Action icon={FileDown} label={Platform.OS === 'web' ? 'Print or save as PDF' : 'Share as PDF'} onPress={sharePdf} busy={sharing} primary />
          <Action
            icon={MessageCircle}
            label="Send on WhatsApp"
            onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(receiptText(v))}`)}
          />
          {error && <Text variant="error">{error}</Text>}
        </Appear>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon: Icon, label, onPress, busy, primary }: {
  icon: typeof FileDown;
  label: string;
  onPress: () => void;
  busy?: boolean;
  primary?: boolean;
}) {
  const theme = useTheme();
  const fg = primary ? theme.accentText : theme.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: primary ? theme.accent : theme.surfaceMuted, opacity: busy ? 0.6 : 1 }}>
      <Icon size={18} color={fg} />
      <Text style={{ color: fg, fontWeight: '800' }}>{busy ? 'Preparing…' : label}</Text>
    </PressableScale>
  );
}
