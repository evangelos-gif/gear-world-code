import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { SearchBox } from '@/components/search-box';
import { Chip, ErrorBox, Loading, TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { searchAll, type SearchResult } from '@/lib/api';
import { countByWorld, decodePhotoParam, encodePhotoParam, orderByBest, photoResults, photoWords } from '@/lib/photo';
import { rememberProducts } from '@/lib/product-cache';
import { worldTitle } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, S } from '@/theme';

export default function SearchScreen() {
  const { t, list } = useI18n();
  const { find } = useWorlds();
  const params = useLocalSearchParams<{ q?: string; photo?: string }>();
  const q = String(params.q ?? '').trim();
  // Set when the search came from a photo: then the words are searched like the Hub's camera button does.
  const photoParam = String(params.photo ?? '');
  const photo = useMemo(() => decodePhotoParam(photoParam), [photoParam]);
  const [used, setUsed] = useState(q);
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
      if (photo) {
        let partial = false;
        const found = await photoResults(photo, async words => {
          try {
            const r = await searchAll(words);
            if (r.partial) partial = true;
            return r.products;
          } catch {
            return null;
          }
        });
        if (!found) throw new Error('load');
        const products = orderByBest(found.products, photo.world?.key);
        rememberProducts(products);
        setUsed(found.query);
        setResult({ products, counts: countByWorld(products), partial });
      } else {
        const r = await searchAll(q);
        rememberProducts(r.products);
        setUsed(q);
        setResult(r);
      }
    } catch {
      setResult(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [q, photo]);

  useEffect(() => { run(); }, [run]);

  const titles = list('worldTitles');
  const shown = useMemo(() => (result ? result.products.filter(p => !filter || p.worldKey === filter) : []), [result, filter]);
  const worldLabel = (key: string) => {
    const w = find(key);
    return w ? worldTitle(w, titles) : key;
  };

  const best = photo?.world ? (find(photo.world.key) ? worldLabel(photo.world.key) : photo.world.name) : '';

  const header = (
    <View style={s.header}>
      <SearchBox key={`${q}|${photoParam}|${used}`} initial={photo && !loading ? used : q}
        onSearch={v => router.setParams({ q: v, photo: '' })}
        onPhoto={a => router.setParams({ q: a.query, photo: encodePhotoParam(a) })} />
      {loading ? <Loading label={t('searchingAll', { query: q })} /> : null}
      {error ? <ErrorBox message={t('loadError')} onRetry={run} /> : null}
      {photo && result && !loading ? (
        <View style={s.photo} accessibilityLiveRegion="polite">
          <Txt style={s.photoFound}>{t('photoFound', { words: photoWords(photo, used) })}</Txt>
          {photo.brand ? <Txt v="small" style={s.photoMeta}>{t('photoBrand', { brand: photo.brand })}</Txt> : null}
          {best ? <Txt v="small" style={s.photoMeta}>{t('photoBestMatch', { world: best })}</Txt> : null}
          <Txt v="small" style={s.photoHint}>{t('photoEditHint')}</Txt>
        </View>
      ) : null}
      {result && !loading ? (
        <View style={s.summary}>
          <Txt v="muted" accessibilityLiveRegion="polite">
            {result.products.length > 0
              ? t('productsFound', { count: result.products.length, worlds: Object.keys(result.counts).length })
              : t('noProductsFor', { query: photo ? used : q })}
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
  photo: { gap: S.xs, padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderLeftColor: C.gold, backgroundColor: C.card },
  photoFound: { color: C.text, fontWeight: '800' },
  photoMeta: { color: C.text },
  photoHint: { color: C.faint },
  partial: { color: C.blue },
  chips: { gap: S.sm, paddingVertical: S.xs },
  colWrap: { gap: S.md },
  cell: { flex: 1, maxWidth: '50%' }
});
