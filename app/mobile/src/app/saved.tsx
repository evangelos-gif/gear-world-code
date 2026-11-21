import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TopBar, Txt, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/lib/format';
import { useOnPhone } from '@/lib/on-phone';
import { priceChange, sortSaved, withLatest, type SavedItem } from '@/lib/saved';
import { C, MAX_WIDTH, R, S } from '@/theme';

function ChangeLine({ item }: { item: SavedItem }) {
  const { t, locale } = useI18n();
  const { checking } = useOnPhone();
  const c = priceChange(item);
  const money = (n: number) => formatPrice(n, item.product.currency, locale);
  // Icon + words, never colour alone (lessons L35); gold for a lower price, blue for everything else.
  const line: { icon: IconName; text: string; strong?: boolean } | null =
    c.kind === 'down' ? { icon: 'arrow-down-circle', text: t('priceDown', { amount: money(c.amount) }), strong: true }
      : c.kind === 'up' ? { icon: 'arrow-up-circle-outline', text: t('priceUp', { amount: money(c.amount) }) }
        : c.kind === 'same' ? { icon: 'remove-circle-outline', text: t('priceSame') }
          : c.kind === 'gone' ? { icon: 'alert-circle-outline', text: t('priceGone') }
            : checking ? null : { icon: 'cloud-offline-outline', text: t('priceUnknown') };
  if (!line) return null;
  return (
    <View style={s.change}>
      <Ionicons name={line.icon} size={18} color={line.strong ? C.gold : C.blue} />
      <Txt v="small" style={[s.changeText, line.strong && s.changeStrong]}>{line.text}</Txt>
    </View>
  );
}

function SavedRow({ item }: { item: SavedItem }) {
  const { t, locale } = useI18n();
  const { removeSaved } = useOnPhone();
  const product = withLatest(item);
  const gone = item.latest?.listed === false;
  const price = formatPrice(product.price, product.currency, locale);
  const was = item.savedPrice !== null && item.savedPrice !== product.price ? formatPrice(item.savedPrice, product.currency, locale) : '';
  return (
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${product.name}. ${price}`} style={({ pressed }) => [s.rowMain, pressed && s.pressed]}
        onPress={() => router.push({ pathname: '/product', params: { key: product.key } })}>
        <View style={s.thumb}>
          {product.image ? <Image source={{ uri: product.image }} style={s.thumbImage} contentFit="contain" recyclingKey={product.key} />
            : <Ionicons name="pricetag-outline" size={28} color={C.faint} />}
        </View>
        <View style={s.rowBody}>
          <Txt style={s.world} numberOfLines={1}>{product.worldKey}</Txt>
          <Txt style={s.name} numberOfLines={3}>{product.name}</Txt>
          {price && !gone ? <Txt style={s.price}>{price}</Txt> : null}
          {was ? <Txt v="small">{t('savedWhen', { price: was })}</Txt> : null}
          <ChangeLine item={item} />
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('remove')}: ${product.name}`} hitSlop={6}
        onPress={() => removeSaved(product.key)} style={({ pressed }) => [s.remove, pressed && s.pressed]}>
        <Ionicons name="trash-outline" size={20} color={C.muted} />
        <Txt v="small" style={s.removeText}>{t('remove')}</Txt>
      </Pressable>
    </View>
  );
}

export default function SavedScreen() {
  const { t, locale } = useI18n();
  const { saved, savedReady, checking, checkSaved, clearSaved } = useOnPhone();
  // Android draws the app behind its own buttons at the bottom: the list ends above them (owner, 4/11/2026).
  const bottom = useSafeAreaInsets().bottom;
  const items = useMemo(() => sortSaved(saved), [saved]);

  // Each time this screen opens, the prices are looked up again (at most every 15 minutes, unless pulled down).
  useFocusEffect(useCallback(() => {
    if (savedReady) checkSaved(false);
  }, [savedReady, checkSaved]));

  const lastCheck = Math.max(0, ...saved.map(i => i.latest?.checkedAt ?? 0));
  let time = '';
  try { time = lastCheck ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(lastCheck)) : ''; } catch { time = ''; }

  const askRemoveAll = () => Alert.alert(t('removeAll'), t('removeAllAsk'), [
    { text: t('photoCancel'), style: 'cancel' },
    { text: t('remove'), style: 'destructive', onPress: clearSaved }
  ]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TopBar title={t('savedTitle')} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: S.xxl + bottom }]}
        refreshControl={<RefreshControl refreshing={checking} onRefresh={() => checkSaved(true)} tintColor={C.gold} colors={[C.gold]} />}>
        <View style={s.inner}>
          <View style={s.intro}>
            <Ionicons name="phone-portrait-outline" size={20} color={C.blue} />
            <Txt v="small" style={s.flex}>{t('savedIntro')}</Txt>
          </View>

          {savedReady && items.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="heart-outline" size={44} color={C.gold} />
              <Txt style={s.center}>{t('savedEmpty')}</Txt>
              <Button icon="search" label={t('savedFind')} onPress={() => router.replace('/')} />
            </View>
          ) : null}

          {items.length > 0 && (checking || time) ? (
            <View style={s.status} accessibilityLiveRegion="polite">
              <Ionicons name={checking ? 'sync-outline' : 'time-outline'} size={16} color={C.muted} />
              <Txt v="small" style={s.flex}>{checking ? t('savedChecking') : t('savedChecked', { time })}</Txt>
            </View>
          ) : null}

          {items.map(item => <SavedRow key={item.product.key} item={item} />)}

          {items.length ? (
            <>
              <Txt v="small">{t('priceNote')}</Txt>
              <Button kind="secondary" icon="trash-outline" label={t('removeAll')} onPress={askRemoveAll} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: S.xxl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: S.lg, gap: S.md },
  intro: { flexDirection: 'row', gap: S.sm, backgroundColor: C.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.border },
  flex: { flex: 1 },
  empty: { alignItems: 'center', gap: S.md, padding: S.xl, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  center: { textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  row: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  rowMain: { flexDirection: 'row', gap: S.md, padding: S.md },
  pressed: { opacity: 0.8 },
  thumb: { width: 96, height: 96, borderRadius: R.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 4 },
  world: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '800' },
  change: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
  changeText: { flex: 1, color: C.text },
  changeStrong: { color: C.gold, fontWeight: '800' },
  remove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderTopWidth: 1, borderTopColor: C.border },
  removeText: { fontWeight: '700' }
});
