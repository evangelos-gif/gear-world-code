import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { Button, ErrorBox, Loading, TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { lookupBarcode, type SearchResult } from '@/lib/api';
import { gtinForms } from '@/lib/barcode';
import { rememberProducts } from '@/lib/product-cache';
import { worldTitle } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, S } from '@/theme';

/** One barcode, looked for in every Gear World by the Hub: each retailer's offer with its price and check day. */
export default function BarcodeScreen() {
  const { t, list } = useI18n();
  const { find } = useWorlds();
  // Android draws the app behind its own buttons at the bottom: the list ends above them (owner, 4/11/2026).
  const bottom = useSafeAreaInsets().bottom;
  const params = useLocalSearchParams<{ code?: string }>();
  const forms = gtinForms(params.code);
  const code = forms[0] ?? '';
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<'' | 'load' | 'unavailable'>('');
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const r = await lookupBarcode(gtinForms(code));
      rememberProducts(r.products);
      setResult(r);
    } catch (e) {
      setResult(null);
      // 404/501: the Hub does not offer barcode search (yet); anything else is the connection.
      const status = (e as { status?: number }).status ?? 0;
      setError(status === 404 || status === 501 ? 'unavailable' : 'load');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { run(); }, [run]);

  const titles = list('worldTitles');
  const worldsFound = result ? Object.keys(result.counts) : [];
  const worldNames = worldsFound.map(k => { const w = find(k); return w ? worldTitle(w, titles) : k; }).join(' · ');

  const header = (
    <View style={s.header}>
      <Txt v="title">{t('scanResults', { code })}</Txt>
      {!code ? <ErrorBox message={t('scanInvalid')} /> : null}
      {loading ? <Loading label={t('scanLooking', { code })} /> : null}
      {error === 'load' ? <ErrorBox message={t('loadError')} onRetry={run} /> : null}
      {error === 'unavailable' ? <ErrorBox message={t('scanUnavailable')} /> : null}
      {result && !loading ? (
        <View style={s.summary} accessibilityLiveRegion="polite">
          {result.products.length > 0
            ? <Txt v="muted">{t('productsFound', { count: result.products.length, worlds: worldsFound.length })}</Txt>
            : <Txt v="muted">{t('scanNone', { code })}</Txt>}
          {worldNames ? <Txt v="small" style={s.worlds}>{worldNames}</Txt> : null}
          {result.partial ? <Txt v="small" style={s.partial}>{t('partial')}</Txt> : null}
        </View>
      ) : null}
      {(result && !result.products.length) || error ? (
        <Button kind="secondary" icon="search" label={t('scanByName')} onPress={() => router.push('/search')} />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TopBar title={t('scanBarcode')} />
      <FlatList
        data={loading || error ? [] : result?.products ?? []}
        keyExtractor={p => p.key}
        numColumns={2}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={s.footer}><Button kind="secondary" icon="barcode-outline" label={t('scanAgain')} onPress={() => router.back()} /></View>}
        columnWrapperStyle={s.colWrap}
        contentContainerStyle={[s.list, { paddingBottom: S.xxl + bottom }]}
        renderItem={({ item }) => <View style={s.cell}><ProductCard product={item} showWorld /></View>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  list: { paddingHorizontal: S.lg, gap: S.md, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { gap: S.md, paddingTop: S.lg, paddingBottom: S.sm },
  summary: { gap: S.xs },
  worlds: { color: C.gold, fontWeight: '700' },
  partial: { color: C.blue },
  footer: { paddingTop: S.lg },
  colWrap: { gap: S.md },
  cell: { flex: 1, maxWidth: '50%' }
});
