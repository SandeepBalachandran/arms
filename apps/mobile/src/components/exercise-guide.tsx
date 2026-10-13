import { howToText, videoLink, type GuideLanguage } from '@gymos/shared';
import { Image } from 'expo-image';
import { BookOpen, ExternalLink, PlayCircle } from 'lucide-react-native';
import { Linking, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile, useSetLanguage } from '@/lib/profile';
import type { ExerciseGuide } from '@/lib/workouts';

// How to do an exercise, as the gym set it up: equipment photos, a video
// link and instructions in the member's language (English or Malayalam).
export function ExerciseGuideSheet({ exercise, guide, onClose }: {
  exercise: { name: string; muscle_group: string } | null;
  guide: ExerciseGuide | undefined;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const profile = useProfile();
  const setLanguage = useSetLanguage();
  const language = (profile.data?.language ?? 'en') as GuideLanguage;
  const text = howToText(guide, language);
  const bilingual = !!guide?.how_to_en?.trim() && !!guide?.how_to_ml?.trim();
  const video = videoLink(guide?.video_url);
  const photoWidth = Math.min(width - Spacing.three * 2, 520);

  return (
    <Modal visible={!!exercise} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three, paddingBottom: Spacing.two }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={2}>{exercise?.name}</Text>
            {exercise && <Text variant="small">{exercise.muscle_group}</Text>}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: theme.brand, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingTop: 0, gap: Spacing.three }}>
          {!!guide?.photo_urls.length && (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {guide.photo_urls.map((url, i) => (
                <Image
                  key={url}
                  source={url}
                  contentFit="cover"
                  accessibilityLabel={`${exercise?.name}, photo ${i + 1} of ${guide.photo_urls.length}`}
                  style={{ width: guide.photo_urls.length > 1 ? photoWidth * 0.86 : photoWidth, aspectRatio: 4 / 3, borderRadius: 20, backgroundColor: theme.surfaceMuted }}
                />
              ))}
            </ScrollView>
          )}

          {video && (
            <Pressable
              onPress={() => Linking.openURL(video.url)}
              accessibilityRole="link"
              accessibilityLabel={`Watch on ${video.label}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: theme.hero, opacity: pressed ? 0.8 : 1 })}>
              {video.thumbnail ? (
                <View>
                  <Image source={video.thumbnail} contentFit="cover" style={{ width: 112, height: 64, borderRadius: 12 }} />
                  <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <PlayCircle size={28} color="#ffffff" />
                  </View>
                </View>
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayCircle size={28} color={theme.accent} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.heroText, fontWeight: '700' }}>Watch how it’s done</Text>
                <Text style={{ color: theme.heroMuted, fontSize: 13 }}>Opens in {video.label}</Text>
              </View>
              <ExternalLink size={18} color={theme.heroMuted} />
            </Pressable>
          )}

          {text && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} color={theme.text} />
                <Text style={{ fontWeight: '700', flex: 1 }}>{language === 'ml' && guide?.how_to_ml?.trim() ? 'എങ്ങനെ ചെയ്യാം' : 'How to do it'}</Text>
              </View>
              {bilingual && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['en', 'ml'] as const).map((l) => (
                    <Pressable
                      key={l}
                      onPress={() => language !== l && setLanguage.mutate(l)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: language === l }}>
                      <Chip tone={language === l ? 'accent' : 'outline'}>{l === 'en' ? 'English' : 'മലയാളം'}</Chip>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={{ fontSize: 16, lineHeight: 25 }}>{text}</Text>
            </View>
          )}

          {!guide && (
            <Text variant="muted" style={{ textAlign: 'center', marginTop: 24 }}>
              Your gym hasn’t added a guide for this exercise yet. Ask your trainer to show you.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
