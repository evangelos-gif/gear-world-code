import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Deals } from '@/components/deals';
import { Footer } from '@/components/footer';
import { Newsletter } from '@/components/newsletter';
import { SearchBox } from '@/components/search-box';
import { SeasonBanner } from '@/components/season-banner';
import { LanguageButton } from '@/components/language-button';
import { Chip, Txt } from '@/components/ui';
import { WorldCard } from '@/components/world-card';
import { useI18n } from '@/i18n';
import { getDealsData } from '@/lib/api';
import { activeDeals, DEALS_SHOWN, parseDeals, ukDay, type Deal, type Target } from '@/lib/seasons';
import { INTERESTS } from '@/lib/worlds-meta';
import { useWorlds } from '@/lib/worlds-context';
import { C, MAX_WIDTH, R, S } from '@/theme';

export default function Home() {
  const { t, list } = useI18n();
  const { worlds, loading, refresh, find } = useWorlds();
  // Android draws the app behind its own buttons at the bottom: the list ends above them (owner, 4/11/2026).
  const bottom = useSafeAreaInsets().bottom;
  const steps = list('steps');
  const scroll = useRef<ScrollViewInstance>(null);
  const places = useRef<Record<string, number>>({});
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoaded, setDealsLoaded] = useState(false);

  // The Hub's deals: read each time the app starts or the person pulls down to refresh.
  const loadDeals = useCallback(() => {
    getDealsData()
      .then(data => setDeals(parseDeals(data)))
      .catch(() => setDeals([]))
      .finally(() => setDealsLoaded(true));
  }, []);
  useEffect(() => { loadDeals(); }, [loadDeals]);

  const today = ukDay(Date.now());
  const shownDeals = activeDeals(deals, today).slice(0, DEALS_SHOWN);
  const remember = (name: string) => (e: { nativeEvent: { layout: { y: number } } }) => { places.current[name] = e.nativeEvent.layout.y; };
  const goTo = (target: Target) => {
    if (typeof target === 'object') { router.push({ pathname: '/world/[key]', params: { key: target.world } }); return; }
    scroll.current?.scrollTo({ y: Math.max(0, (places.current[target] ?? 0) - S.sm), animated: true });
  };

  const pairs: (typeof worlds)[] = [];
  for (let i = 0; i < worlds.length; i += 2) pairs.push(worlds.slice(i, i + 2));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.topbar}>
        <Image source={require('@/assets/brand/logo-horizontal.png')} style={s.logo} contentFit="contain"
          accessibilityLabel="Gear World" />
        <LanguageButton />
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={[s.scroll, { paddingBottom: S.xxl + bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { refresh(); loadDeals(); }} tintColor={C.gold} colors={[C.gold]} />}>
        <View style={s.inner}>
          <View style={s.hero}>
            <Txt v="eyebrow">{t('heroEyebrow')}</Txt>
            <Txt v="title">{t('heroTitle1')} <Txt v="title" style={s.gold}>{t('heroTitle2')}</Txt></Txt>
            <Txt v="muted">{t('heroDesc')}</Txt>
            <SearchBox onSearch={q => router.push({ pathname: '/search', params: { q } })} />
          </View>

          <SeasonBanner hasDeals={shownDeals.length > 0} dealsLoaded={dealsLoaded} onTarget={goTo} />

          {shownDeals.length ? (
            <View style={s.section} onLayout={remember('deals')}>
              <Deals deals={shownDeals} day={today} />
            </View>
          ) : null}

          <View style={s.section} onLayout={remember('worlds')}>
            <Txt v="eyebrow">{t('choose')}</Txt>
            <Txt v="h2">{t('exploreWorlds')}</Txt>
            <View style={s.grid}>
              {pairs.map(row => (
                <View key={row.map(w => w.key).join('-')} style={s.row}>
                  {row.map(w => <WorldCard key={w.key} world={w} onPress={() => router.push({ pathname: '/world/[key]', params: { key: w.key } })} />)}
                  {row.length === 1 ? <View style={s.spacer} /> : null}
                </View>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <Txt v="h2">{t('shopInterest')}</Txt>
            <Txt v="muted">{t('interestDesc')}</Txt>
            <View style={s.chips}>
              {INTERESTS.filter(i => find(i.world)).map(i => (
                <Chip key={i.label} label={t(i.label)}
                  onPress={() => router.push({ pathname: '/world/[key]', params: { key: i.world, category: i.category } })} />
              ))}
            </View>
          </View>

          <View style={[s.section, s.how]}>
            <Txt v="eyebrow">{t('howLabel')}</Txt>
            <Txt v="label">{t('howTitle')}</Txt>
            {steps.map((step, i) => (
              <View key={step} style={s.step}>
                <View style={s.stepNo}><Txt style={s.stepNoText}>{i + 1}</Txt></View>
                <Txt style={s.stepText}>{step}</Txt>
              </View>
            ))}
            <View style={s.disclosure}>
              <Ionicons name="information-circle-outline" size={20} color={C.blue} />
              <Txt v="small" style={s.flex}>{t('disclosure')}</Txt>
            </View>
          </View>

          <View style={s.section} onLayout={remember('newsletter')}>
            <Newsletter />
          </View>

          <Footer />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.sm, backgroundColor: C.bgDeep, borderBottomWidth: 1, borderBottomColor: C.border },
  logo: { width: 150, height: 46 },
  scroll: { paddingBottom: S.xxl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: S.lg, gap: S.xl, paddingTop: S.lg },
  hero: { gap: S.md },
  gold: { color: C.gold },
  section: { gap: S.md },
  grid: { gap: S.md },
  row: { flexDirection: 'row', gap: S.md },
  spacer: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  how: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: C.border },
  step: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  stepNo: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: C.onGold, fontWeight: '800' },
  stepText: { flex: 1, fontWeight: '600' },
  disclosure: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  flex: { flex: 1 }
});
