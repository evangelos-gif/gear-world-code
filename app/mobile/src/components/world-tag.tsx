import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { worldIcon } from '@/lib/warm';
import { worldTitle } from '@/lib/worlds-meta';
import { C } from '@/theme';
import { Txt } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The Gear World of a product, by its name in the person's language with its icon ("Kids & Teens"), instead of its
 * code ("KGW"). Idea 17 Α, version 1.0.2. The icon is next to the words, never alone (lessons L35).
 */
export function WorldTag({ worldKey, name }: { worldKey: string; name?: string }) {
  const { list } = useI18n();
  const title = worldTitle({ key: worldKey, name: name || worldKey }, list('worldTitles'));
  return (
    <View style={s.row}>
      <Ionicons name={worldIcon(worldKey) as IconName} size={14} color={C.gold} accessible={false} />
      <Txt style={s.text} numberOfLines={1}>{title}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { flexShrink: 1, color: C.gold, fontSize: 12, lineHeight: 16, fontWeight: '800' }
});
