import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { World } from '@/lib/api';
import { worldDescription, worldImage, worldTitle } from '@/lib/worlds-meta';
import { useI18n } from '@/i18n';
import { C, R, S } from '@/theme';
import { ImageShade, TEXT_ON_PICTURE } from './image-shade';
import { Txt } from './ui';

export function WorldCard({ world, onPress }: { world: World; onPress: () => void }) {
  const { list } = useI18n();
  const title = worldTitle(world, list('worldTitles'));
  const desc = worldDescription(world, list('worldDescriptions'));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${desc}`} onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.pressed]}>
      <Image source={{ uri: worldImage(world.key) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200}
        accessibilityIgnoresInvertColors />
      <ImageShade />
      <View style={s.text}>
        <Txt style={s.code}>{world.key}</Txt>
        <Txt style={s.title} numberOfLines={2}>{title}</Txt>
        {desc ? <Txt style={s.desc} numberOfLines={2}>{desc}</Txt> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, minHeight: 168, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.cardHigh, borderWidth: 1, borderColor: C.border },
  pressed: { opacity: 0.85 },
  text: { flex: 1, justifyContent: 'flex-end', padding: S.md, gap: 2 },
  code: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1, ...TEXT_ON_PICTURE },
  title: { color: C.text, fontSize: 18, lineHeight: 22, fontWeight: '800', ...TEXT_ON_PICTURE },
  desc: { color: C.text, fontSize: 13, lineHeight: 17, ...TEXT_ON_PICTURE }
});
