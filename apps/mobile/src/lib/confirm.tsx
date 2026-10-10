import { TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { Button, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

// In-app yes/no popup before a destructive action, styled like the app (no
// system alert). Call confirm() from anywhere; <ConfirmHost /> in the root
// layout shows it. Resolves true when confirmed.

type Request = {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  resolve: (ok: boolean) => void;
};

let show: ((r: Request) => void) | null = null;

export function confirm(options: Omit<Request, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(false);
    show({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    show = setRequest;
    return () => {
      show = null;
    };
  }, []);

  function close(ok: boolean) {
    request?.resolve(ok);
    setRequest(null);
  }

  return (
    <Modal visible={!!request} transparent animationType="none" onRequestClose={() => close(false)} statusBarTranslucent>
      {request && (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(150)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => close(false)} accessibilityLabel="Close" />
          <Animated.View
            entering={reduced ? undefined : ZoomIn.springify().damping(16)}
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={{ width: '100%', maxWidth: 360, backgroundColor: theme.surface, borderRadius: 28, padding: 22, gap: 14, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(220,38,38,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <TriangleAlert size={26} color={theme.danger} />
            </View>
            <View style={{ gap: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontWeight: '800', textAlign: 'center' }}>{request.title}</Text>
              {request.message && <Text variant="muted" style={{ textAlign: 'center' }}>{request.message}</Text>}
            </View>
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => close(true)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  minHeight: 52,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.danger,
                  opacity: pressed ? 0.8 : 1,
                })}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>{request.confirmText}</Text>
              </Pressable>
              <Button title={request.cancelText ?? 'Cancel'} variant="secondary" onPress={() => close(false)} />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}
