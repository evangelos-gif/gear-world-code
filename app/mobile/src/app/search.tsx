import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { SearchBox } from '@/components/search-box';
import { Chip, ErrorBox, Loading, TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { searchAll, type SearchResult } from '@/lib/api';
import { rememberProducts } from '@/lib/product-cache';
import { worldTitle } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, S } from '@/theme';

export default function SearchScreen() {
  const { t, list } = useI18n();
  const { find } = useWorlds();
  const params = useLocalSearchParams<{ q?: string }>();
  const q = String(params.q ?? '').trim();
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const run = useCallback(async () => {
    if (q.length < 2) return;
    setLoading(true);
    setError(false);
    setFilter('');
    try {
      const r = await searchAll(q);
      rememberProducts(r.products);
      setResult(r);
    } catch {
      setResult(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { run(); }, [run]);

  const titles = list('worldTitles');
  const shown = useMemo(() => (result ? result.products.filter(p => !filter || p.worldKey === filter) : []), [result, filter]);
  const worldLabel = (key: string) => {
    const w = find(key);
    return w ? worldTitle(w, titles) : key;
  };

  const header = (
    <View style={s.header}>
      <SearchBox key={q} initial={q} onSearch={v => router.setParams({ q: v })} />
      {loading ? <Loading label={t('searchingAll', { query: q })} /> : null}
      {error ? <ErrorBox message={t('loadError')} onRetry={run} /> : null}
      {result && !loading ? (
        <View style={s.summary}>
          <Txt v="muted" accessibilityLiveRegion="polite">
            {result.products.length > 0
              ? t('productsFound', { count: result.products.length, worlds: Object.keys(result.counts).length })
              : t('noProductsFor', { query: q })}
          </Txt>
          {result.partial ? <Txt v="small" style={s.partial}>{t('partial')}</Txt> : null}
          {Object.keys(result.counts).length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <Chip label={`${t('allFilter')} (${result.products.length})`} selected={!filter} onPress={() => setFilter('')} />
              {Object.entries(result.counts).map(([k, n]) => (
                <Chip key={k} label={`${worldLabel(k)} (${n})`} selected={filter === k} onPress={() => setFilter(k)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TopBar title={t('searchButton')} />
      <FlatList
        data={loading || error ? [] : shown}
        keyExtractor={p => p.key}
        numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={s.colWrap}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <View style={s.cell}><ProductCard product={item} showWorld /></View>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.md, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { gap: S.md, paddingTop: S.lg, paddingBottom: S.sm },
  summary: { gap: S.sm },
  partial: { color: C.blue },
  chips: { gap: S.sm, paddingVertical: S.xs },
  colWrap: { gap: S.md },
  cell: { flex: 1, maxWidth: '50%' }
});
