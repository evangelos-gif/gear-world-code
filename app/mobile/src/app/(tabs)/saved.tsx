import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDay, formatPrice } from '@/lib/format';
import type { SavedItem } from '@/lib/saved';
import { useSaved } from '@/lib/saved-context';
import { C, MAX_WIDTH, R, S } from '@/theme';

/**
 * Saved products (version 1.0.1). The list and the pictures are kept on the phone, so this tab opens without internet,
 * with the price and the day the site last checked it. Online, it asks each site for the newest price once per visit.
 */
export default function SavedScreen() {
  const { t } = useI18n();
  const { items, ready, refreshing, offline, refresh } = useSaved();
  const checkedOnce = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!checkedOnce.current && items.length) { checkedOnce.current = true; refresh(); }
  }, [items.length, refresh]));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={x => x.key}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.gold} colors={[C.gold]} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Txt v="title">{t('savedTitle')}</Txt>
            {offline ? (
              <View style={s.note} accessibilityLiveRegion="polite">
                <Ionicons name="cloud-offline-outline" size={20} color={C.blue} />
                <Txt v="small" style={s.flex}>{t('savedOffline')}</Txt>
              </View>
            ) : null}
            {items.length ? <Txt v="small" style={s.faint}>{t('savedPull')}</Txt> : null}
          </View>
        }
        ListEmptyComponent={ready ? (
          <View style={s.empty}>
            <Ionicons name="bookmark-outline" size={48} color={C.gold} />
            <Txt style={s.center}>{t('savedEmpty')}</Txt>
          </View>
        ) : undefined}
        renderItem={({ item }) => <SavedRow item={item} />}
      />
    </SafeAreaView>
  );
}

function SavedRow({ item }: { item: SavedItem }) {
  const { t, locale } = useI18n();
  const { remove } = useSaved();
  const price = formatPrice(item.price, item.currency, locale);
  const site = item.base.replace('https://', '');
  const picture = item.imageFile || item.image;
  return (
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}. ${price}. ${item.retailer}`}
        onPress={() => router.push({ pathname: '/product', params: { key: item.key } })}
        style={({ pressed }) => [s.main, pressed && s.pressed]}>
        <View style={s.imageBox}>
          {picture ? <Image source={{ uri: picture }} style={s.image} contentFit="contain" cachePolicy="disk" />
            : <Ionicons name="pricetag-outline" size={28} color={C.faint} />}
        </View>
        <View style={s.body}>
          <Txt style={s.world} numberOfLines={1}>{item.worldKey}</Txt>
          <Txt style={s.name} numberOfLines={2}>{item.name}</Txt>
          {item.notListed ? (
            <Txt v="small" style={s.gone}>{t('notListed', { site })}</Txt>
          ) : (
            <>
              {price ? <Txt style={s.price}>{price}</Txt> : null}
              {item.retailer ? <Txt v="small" numberOfLines={1}>{item.retailer}</Txt> : null}
            </>
          )}
          <Txt v="small" style={s.faint}>
            {item.checked ? t('priceChecked', { date: formatDay(item.checked, locale, 'short') }) : t('savedOn', { date: formatDay(item.savedAt, locale, 'short') })}
          </Txt>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('removeBtn')}: ${item.name}`} hitSlop={8}
        onPress={() => remove(item.key)} style={({ pressed }) => [s.remove, pressed && s.pressed]}>
        <Ionicons name="trash-outline" size={20} color={C.muted} />
        <Txt v="small">{t('removeBtn')}</Txt>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  list: { padding: S.lg, gap: S.md, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { gap: S.sm, paddingBottom: S.sm },
  note: { flexDirection: 'row', gap: S.sm, alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, padding: S.md, borderLeftWidth: 4, borderLeftColor: C.blue },
  flex: { flex: 1 },
  faint: { color: C.faint },
  empty: { alignItems: 'center', gap: S.md, paddingVertical: S.xxl, paddingHorizontal: S.lg },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  main: { flex: 1, flexDirection: 'row', gap: S.md, padding: S.md },
  pressed: { opacity: 0.8 },
  imageBox: { width: 84, height: 84, borderRadius: R.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  body: { flex: 1, gap: 2 },
  world: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  name: { fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '800' },
  gone: { color: C.blue, fontWeight: '700' },
  remove: { width: 76, alignItems: 'center', justifyContent: 'center', gap: 2, borderLeftWidth: 1, borderLeftColor: C.border }
});
