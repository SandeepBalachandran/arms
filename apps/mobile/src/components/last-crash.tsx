import { BRAND } from '@gymos/shared';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { clearLastCrash, readLastCrash, type CrashReport } from '@/lib/crash-log';

// After the app closed on an error, show what it was once, so it can be sent
// to us. Plain React Native only: this must work even if the rest doesn't.
export function LastCrashNotice() {
  const [report, setReport] = useState(readLastCrash);
  if (!report) return null;

  function close() {
    clearLastCrash();
    setReport(null);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#1f2a10', borderRadius: 24, padding: 20, gap: 12 }}>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800' }}>{BRAND.name} closed unexpectedly</Text>
          <Text style={{ color: '#c3cdb2', fontSize: 14 }}>
            Sorry about that. Copy the details below and send them to the {BRAND.name} team so we can fix it.
          </Text>
          <CrashDetails report={report} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PillButton title="Copy details" primary onPress={() => Clipboard.setStringAsync(formatReport(report))} />
            <PillButton title="Close" onPress={close} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function CrashDetails({ report }: { report: CrashReport }) {
  return (
    <ScrollView style={{ maxHeight: 260, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }} contentContainerStyle={{ padding: 12 }}>
      <Text selectable style={{ color: '#ffffff', fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
        {formatReport(report)}
      </Text>
    </ScrollView>
  );
}

export function formatReport(r: CrashReport) {
  return `${r.message}\n${r.device} · ${r.at}${r.fatal ? ' · fatal' : ''}\n\n${r.stack}`;
}

function PillButton({ title, onPress, primary }: { title: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? '#c8f04b' : 'rgba(255,255,255,0.1)',
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ color: primary ? '#141a04' : '#ffffff', fontSize: 15, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}
