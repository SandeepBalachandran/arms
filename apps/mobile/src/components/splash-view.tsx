import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { readSplashBrand } from '@/lib/splash-brand';

const HERO = '#1f2a10';
const LIME = '#c8f04b';

// Shown while the session and gyms load, after the native splash (same dark
// background and artwork, app.json). The dumbbell pops in and lifts, rings
// pulse out, and the member's gym (remembered from last time) fades in.
export function SplashView() {
  const reduced = useReducedMotion();
  const [brand] = useState(readSplashBrand);
  const enter = (delay: number) => (reduced ? undefined : FadeInDown.delay(delay).duration(500));

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: HERO, overflow: 'hidden' }}
      accessibilityLabel={brand ? `GOS for ${brand.name} is loading` : 'GOS is loading'}>
      {!reduced && [0, 1, 2].map((i) => <Ring key={i} delay={i * 700} />)}

      <Dumbbell reduced={reduced} />

      <Animated.View entering={enter(250)} style={{ flexDirection: 'row', marginTop: 22 }}>
        <Text style={{ fontSize: 46, fontWeight: '800', letterSpacing: -1.5, color: '#ffffff' }}>G</Text>
        <Text style={{ fontSize: 46, fontWeight: '800', letterSpacing: -1.5, color: LIME }}>OS</Text>
      </Animated.View>

      {brand && (
        <Animated.View
          entering={enter(550)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 18,
            paddingLeft: brand.logo_url ? 6 : 16,
            paddingRight: 16,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(200,240,75,0.25)',
          }}>
          {brand.logo_url && <Image source={{ uri: brand.logo_url }} style={{ width: 28, height: 28, borderRadius: 8 }} />}
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
            {brand.name}
          </Text>
        </Animated.View>
      )}

      <LoadingBar reduced={reduced} />
    </View>
  );
}

// Lime dumbbell drawn with views: springs in, then lifts gently.
function Dumbbell({ reduced }: { reduced: boolean }) {
  const scale = useSharedValue(reduced ? 1 : 0.3);
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    scale.set(withSpring(1, { damping: 9, stiffness: 140 }));
    lift.set(withDelay(600, withRepeat(withSequence(
      withTiming(-10, { duration: 600, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) }),
    ), -1)));
  }, [reduced, scale, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { scale: scale.value }] }));

  const plate = (w: number, h: number) => ({ width: w, height: h, borderRadius: w / 3.5, backgroundColor: LIME });
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={plate(26, 64)} />
      <View style={plate(20, 34)} />
      <View style={{ width: 52, height: 12, backgroundColor: LIME }} />
      <View style={plate(20, 34)} />
      <View style={plate(26, 64)} />
    </Animated.View>
  );
}

// A ring that grows from the centre and fades, on repeat.
function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2100, easing: Easing.out(Easing.cubic) }), -1)));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - t.value), transform: [{ scale: 0.4 + t.value * 1.8 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderColor: LIME }, style]}
    />
  );
}

// Indeterminate bar near the bottom.
function LoadingBar({ reduced }: { reduced: boolean }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (!reduced) x.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduced, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + x.value * 80 }] }));
  return (
    <View style={{ position: 'absolute', bottom: 72, width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      <Animated.View style={[{ width: 40, height: 4, borderRadius: 2, backgroundColor: LIME, marginLeft: 40 }, style]} />
    </View>
  );
}
