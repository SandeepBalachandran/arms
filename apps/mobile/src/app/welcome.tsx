import { useRouter } from 'expo-router';
import { CalendarCheck, ChevronRight, CreditCard, Dumbbell, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { markWelcomed } from '@/lib/welcome';

const SLIDES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Dumbbell,
    title: 'Reach higher every workout',
    body: 'Your gym in your pocket: membership, workouts and progress in one place.',
  },
  {
    icon: CalendarCheck,
    title: 'Check in and book in a tap',
    body: 'Show your QR at the desk, book group classes and follow your trainer’s plan.',
  },
  {
    icon: CreditCard,
    title: 'Renew without the queue',
    body: 'See your plan and days left, pay by UPI and keep every receipt.',
  },
];

// First-launch intro before sign-in. Shown once per install.
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  function finish() {
    markWelcomed();
    router.replace('/sign-in');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: Spacing.three, height: 40, justifyContent: 'center' }}>
        {!last && (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontWeight: '600' }}>Skip</Text>
            <ChevronRight size={18} color={theme.text} />
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}>
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width, paddingHorizontal: Spacing.four, justifyContent: 'center', gap: Spacing.four }}>
            <Art icon={s.icon} />
            <View style={{ gap: Spacing.two }}>
              <Text style={{ fontSize: 34, fontWeight: '800', textAlign: 'center', letterSpacing: -0.8, lineHeight: 38 }}>{s.title}</Text>
              <Text variant="muted" style={{ textAlign: 'center', paddingHorizontal: Spacing.three }}>
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ padding: Spacing.four, gap: Spacing.four }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={{ height: 8, width: i === index ? 22 : 8, borderRadius: 4, backgroundColor: i === index ? theme.accent : theme.border }}
            />
          ))}
        </View>
        <Button
          title={last ? 'Get Started' : 'Next'}
          onPress={() => (last ? finish() : scroller.current?.scrollTo({ x: (index + 1) * width, animated: true }))}
        />
      </View>
    </SafeAreaView>
  );
}

// Lime block with a big icon in a dark disc, in place of a photo.
function Art({ icon: Icon }: { icon: LucideIcon }) {
  const theme = useTheme();
  return (
    <View style={{ height: 300, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 120, height: 130, borderRadius: 28, backgroundColor: theme.accent }} />
      <View style={{ position: 'absolute', top: 30, right: 30, width: 46, height: 46, borderRadius: 23, backgroundColor: theme.tints.green.bg }} />
      <View style={{ position: 'absolute', bottom: 18, left: 26, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.tints.blue.bg }} />
      <View style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: theme.hero, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={96} color={theme.accent} strokeWidth={1.8} />
      </View>
    </View>
  );
}
