import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
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

// Small motion kit. Everything here turns itself off when the phone's
// "reduce motion" setting is on.

// Slides a block up into place; `index` staggers siblings.
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(420).delay(index * 70).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that shrinks a little while pressed.
export function PressableScale({ style, children, ...props }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(0.96, { damping: 18, stiffness: 300 }));
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 220 }));
        props.onPressOut?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

// Gentle up-and-down drift for decorations.
export function Float({ children, distance = 6, style }: { children: ReactNode; distance?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.set(withRepeat(
      withSequence(
        withTiming(-distance, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    ));
  }, [reduced, distance, y]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

// Soft pulsing dot, e.g. "open now" or the current time on a timeline.
export function Pulse({ color, size = 10 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    s.set(withRepeat(withTiming(2.2, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [reduced, s]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: reduced ? 0 : (2.2 - s.value) / 2.4 }));
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, halo]} />
      <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </Animated.View>
  );
}

// Eases a number from 0 to `target` (JS-driven, so it works for SVG and
// text on every platform).
export function useCountUp(target: number, duration = 900) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return reduced ? target : value;
}

// A bar that grows from the bottom to `height` after `delay` ms.
export function GrowBar({ height, delay = 0, style }: { height: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? height : 0);
  useEffect(() => {
    h.set(reduced ? height : withDelay(delay, withTiming(height, { duration: 650, easing: Easing.out(Easing.cubic) })));
  }, [height, delay, reduced, h]);
  const animated = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[style, animated]} />;
}

// Width that fills from 0 to `fraction` (0–1) of its track.
export function GrowFill({ fraction, style, delay = 150 }: { fraction: number; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduced = useReducedMotion();
  const w = useSharedValue(reduced ? fraction : 0);
  useEffect(() => {
    w.set(reduced ? fraction : withDelay(delay, withTiming(fraction, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [fraction, delay, reduced, w]);
  const animated = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%` }));
  return <Animated.View style={[style, animated]} />;
}
