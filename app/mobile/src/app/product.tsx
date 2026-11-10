import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBox, IconButton, TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDay, formatPrice } from '@/lib/format';
import { openInBrowser } from '@/lib/open';
import { findProduct } from '@/lib/product-cache';
import { useSaved } from '@/lib/saved-context';
import { worldTitle } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, R, S } from '@/theme';

/**
 * One product. What the site knows, said the way the sites say it (lessons L101-L107): who sells it ("not by Gear World"),
 * stock at that retailer, the day the price was checked, the retailer's RRP only as "RRP £X" (never a crossed-out price).
 * A saved product opens from the phone, also without internet.
 */
export default function ProductScreen() {
  const { t, list, locale } = useI18n();
  const { find } = useWorlds();
  const saved = useSaved();
  const params = useLocalSearchParams<{ key?: string }>();
  const key = String(params.key ?? '');
  const product = findProduct(key) ?? saved.find(key);

  if (!product) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <TopBar />
        <ErrorBox message={t('productMissing')} onRetry={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const world = find(product.worldKey);
  const worldName = world ? worldTitle(world, list('worldTitles')) : product.worldName;
  const siteName = world?.domain ?? product.base.replace('https://', '');
  const price = formatPrice(product.price, product.currency, locale);
  const rrp = product.wasPrice && product.price && product.wasPrice > product.price ? formatPrice(product.wasPrice, product.currency, locale) : '';
  const retailer = product.retailer || siteName;
  const isSaved = saved.isSaved(product.key);
  const savedItem = saved.find(product.key);
  const picture = savedItem?.imageFile || product.image;

  const toggleSave = () => {
    saved.toggle(product);
    Haptics.selectionAsync().catch(() => undefined);
  };
  const share = () => {
    Share.share({ message: `${product.name}\n${product.productUrl}`, url: product.productUrl }).catch(() => undefined);
  };

  const rows: [string, string][] = [
    [t('retailer'), product.retailer],
    [t('brand'), product.brand],
    [t('category'), product.category]
  ].filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title={worldName} right={<IconButton icon="share-outline" label={t('share')} onPress={share} />} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.inner}>
          <View style={s.imageBox}>
            {picture ? <Image source={{ uri: picture }} style={s.image} contentFit="contain" transition={150} cachePolicy="disk" />
              : <Ionicons name="pricetag-outline" size={64} color={C.faint} />}
          </View>
          <Txt v="eyebrow">{product.worldName}</Txt>
          <Txt v="h2">{product.name}</Txt>
          <View style={s.priceRow}>
            {price ? <Txt style={s.price}>{price}</Txt> : null}
            {rrp ? <Txt v="muted">{t('rrp', { price: rrp })}</Txt> : null}
          </View>
          {product.checked ? <Txt v="small" style={s.faint}>{t('priceChecked', { date: formatDay(product.checked, locale) })}</Txt> : null}

          <View style={s.facts}>
            <Txt v="small">{t('soldBy', { retailer })}</Txt>
            {product.checkRetailer ? (
              <View style={s.line}>
                <Ionicons name="help-circle-outline" size={18} color={C.blue} />
                <Txt v="small" style={s.flex}>{t('checkRetailer')}</Txt>
              </View>
            ) : product.inStock !== null ? (
              // Icon + words, never colour alone (lessons L35).
              <View style={s.line}>
                <Ionicons name={product.inStock ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={product.inStock ? C.blue : C.faint} />
                <Txt v="small" style={s.flex}>{`${t('stockAt', { retailer })}: ${product.inStock ? t('inStock') : t('outOfStock')}`}</Txt>
              </View>
            ) : null}
          </View>

          <Button icon="open-outline" label={t('viewAt', { retailer })} hint={t('opensBrowser')} onPress={() => openInBrowser(product.outUrl)} />
          <Button kind="secondary" icon={isSaved ? 'bookmark' : 'bookmark-outline'} label={isSaved ? `✓ ${t('savedBtn')}` : `+ ${t('saveBtn')}`}
            hint={t('saveHint')} onPress={toggleSave} />
          <Button kind="secondary" label={t('moreOnSite', { site: siteName })} hint={t('opensBrowser')} onPress={() => openInBrowser(product.productUrl)} />

          <View style={s.table}>
            {rows.map(([k, v]) => (
              <View key={k} style={s.tr}>
                <Txt v="small" style={s.th}>{k}</Txt>
                <Txt style={s.td}>{v}</Txt>
              </View>
            ))}
          </View>

          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={20} color={C.blue} />
            <View style={s.noteBody}>
              <Txt v="small">{t('priceNote')}</Txt>
              <Txt v="small">{t('disclosure')}</Txt>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: S.xxl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: S.lg, gap: S.md },
  imageBox: { height: 300, borderRadius: R.lg, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: S.md },
  price: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  faint: { color: C.faint },
  facts: { gap: S.xs, backgroundColor: C.card, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  table: { borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tr: { flexDirection: 'row', gap: S.md, padding: S.md, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { width: 96, fontWeight: '700' },
  td: { flex: 1 },
  note: { flexDirection: 'row', gap: S.sm, backgroundColor: C.card, borderRadius: R.lg, padding: S.md },
  noteBody: { flex: 1, gap: S.sm }
});
