import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { SearchBox } from '@/components/search-box';
import { Button, Chip, ErrorBox, Loading, TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { worldProducts, type Product, type SortKey } from '@/lib/api';
import { openInBrowser } from '@/lib/open';
import { rememberProducts } from '@/lib/product-cache';
import { worldDescription, worldImage, worldTitle } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, R, S } from '@/theme';

const SORTS: { key: SortKey; label: 'sortFeatured' | 'sortPriceAsc' | 'sortPriceDesc' | 'sortNewest' }[] = [
  { key: 'featured', label: 'sortFeatured' },
  { key: 'price-asc', label: 'sortPriceAsc' },
  { key: 'price-desc', label: 'sortPriceDesc' },
  { key: 'newest', label: 'sortNewest' }
];

export default function WorldScreen() {
  const { t, list } = useI18n();
  const params = useLocalSearchParams<{ key: string; category?: string }>();
  const { find, loading: worldsLoading } = useWorlds();
  const world = find(String(params.key ?? ''));

  const [category, setCategory] = useState(String(params.category ?? ''));
  const [sort, setSort] = useState<SortKey>('featured');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (pageNo: number) => {
    if (!world) return;
    const id = ++request.current;
    setLoading(true);
    setError(false);
    try {
      const r = await worldProducts(world, { search, category, sort, page: pageNo, limit: 24 });
      if (id !== request.current) return;
      rememberProducts(r.products);
      setItems(prev => (pageNo === 1 ? r.products : [...prev, ...r.products.filter(p => !prev.some(x => x.key === p.key))]));
      setPage(pageNo);
      setTotal(r.total);
      setHasMore(r.hasMore);
    } catch {
      if (id === request.current) setError(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [world, search, category, sort]);

  useEffect(() => { load(1); }, [load]);

  if (!world) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <TopBar />
        {worldsLoading ? <Loading /> : <ErrorBox message={t('loadError')} />}
      </SafeAreaView>
    );
  }

  const title = worldTitle(world, list('worldTitles'));
  const desc = worldDescription(world, list('worldDescriptions'));

  const header = (
    <View style={s.header}>
      <View style={s.hero}>
        <Image source={{ uri: worldImage(world.key) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={s.shade} />
        <View style={s.heroText}>
          <Txt v="eyebrow">{world.name}</Txt>
          <Txt v="title">{title}</Txt>
          {desc ? <Txt>{desc}</Txt> : null}
        </View>
      </View>
      <Button kind="secondary" icon="open-outline" label={t('visitSite', { site: world.domain })} hint={t('opensBrowser')}
        onPress={() => openInBrowser(`${world.base}/`)} />
      <SearchBox key={world.key} placeholder={t('searchIn', { world: title })} onSearch={v => setSearch(v)} />
      {search ? <Chip label={`× ${search}`} selected onPress={() => setSearch('')} /> : null}
      {world.categories.length > 0 ? (
        <View style={s.group}>
          <Txt v="label">{t('categories')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            <Chip label={t('allProducts')} selected={!category} onPress={() => setCategory('')} />
            {[...world.categories].sort((a, b) => Number(b.slug === category) - Number(a.slug === category)).map(c => (
              <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(c.slug)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {SORTS.map(o => <Chip key={o.key} label={t(o.label)} selected={sort === o.key} onPress={() => setSort(o.key)} />)}
      </ScrollView>
      {!loading || page > 1 ? <Txt v="small" accessibilityLiveRegion="polite">{t('worldProducts', { count: total })}</Txt> : null}
      {error && items.length === 0 ? <ErrorBox message={t('loadError')} onRetry={() => load(1)} /> : null}
      {loading && page === 1 && items.length === 0 ? <Loading /> : null}
      {!loading && !error && items.length === 0 ? <Txt v="muted">{t('noProducts')}</Txt> : null}
    </View>
  );

  const footer = hasMore && items.length > 0 ? (
    <View style={s.more}>
      {error ? <Txt v="small" style={s.err}>{t('loadError')}</Txt> : null}
      <Button kind="secondary" label={t('loadMore')} busy={loading} onPress={() => load(page + 1)} />
    </View>
  ) : undefined;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TopBar title={title} />
      <FlatList
        data={items}
        keyExtractor={p => p.key}
        numColumns={2}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        columnWrapperStyle={s.colWrap}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <View style={s.cell}><ProductCard product={item} /></View>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  list: { paddingHorizontal: S.lg, paddingBottom: S.xxl, gap: S.md, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { gap: S.md, paddingTop: S.lg, paddingBottom: S.sm },
  hero: { minHeight: 190, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.cardHigh },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,10,31,0.6)' },
  heroText: { flex: 1, justifyContent: 'flex-end', padding: S.lg, gap: S.xs },
  group: { gap: S.sm },
  chips: { gap: S.sm, paddingVertical: S.xs },
  colWrap: { gap: S.md },
  cell: { flex: 1, maxWidth: '50%' },
  more: { paddingTop: S.lg, gap: S.sm },
  err: { color: C.blue }
});
