import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StockLine } from '@/components/product-card';
import { Button, ErrorBox, TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/lib/format';
import { openInBrowser } from '@/lib/open';
import { findProduct } from '@/lib/product-cache';
import { worldTitle } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, R, S } from '@/theme';

export default function ProductScreen() {
  const { t, list, locale } = useI18n();
  const { find } = useWorlds();
  const params = useLocalSearchParams<{ key?: string }>();
  const product = findProduct(String(params.key ?? ''));

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
  const was = product.wasPrice && product.price && product.wasPrice > product.price ? formatPrice(product.wasPrice, product.currency, locale) : '';
  const retailer = product.retailer || siteName;

  const rows: [string, string][] = [
    [t('retailer'), product.retailer],
    [t('brand'), product.brand],
    [t('category'), product.category]
  ].filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title={worldName} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.inner}>
          <View style={s.imageBox}>
            {product.image ? <Image source={{ uri: product.image }} style={s.image} contentFit="contain" transition={150} />
              : <Ionicons name="storefront-outline" size={64} color={C.faint} />}
          </View>
          <Txt v="eyebrow">{product.worldName}</Txt>
          <Txt v="h2">{product.name}</Txt>
          <View style={s.priceRow}>
            {price ? <Txt style={s.price}>{price}</Txt> : null}
            {was ? <Txt v="muted" style={s.was}>{was}</Txt> : null}
          </View>
          <StockLine inStock={product.inStock} size="body" />

          <Button icon="open-outline" label={t('viewAt', { retailer })} hint={t('opensBrowser')} onPress={() => openInBrowser(product.outUrl)} />
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
            <View style={s.flex}>
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
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.md },
  price: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  was: { textDecorationLine: 'line-through' },
  table: { borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tr: { flexDirection: 'row', gap: S.md, padding: S.md, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { width: 96, fontWeight: '700' },
  td: { flex: 1 },
  note: { flexDirection: 'row', gap: S.sm, backgroundColor: C.card, borderRadius: R.lg, padding: S.md },
  flex: { flex: 1, gap: S.sm }
});
