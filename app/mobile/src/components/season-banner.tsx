import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n, type TextKey } from '@/i18n';
import { formatDay } from '@/lib/format';
import { countdownParts, heroSlides, type Slide, type Target } from '@/lib/seasons';
import { HUB_URL } from '@/lib/api';
import { C, R, S } from '@/theme';
import { TEXT_ON_PICTURE } from './image-shade';
import { Txt } from './ui';

// The Hub's seasonal pictures (same files and version as gearworldhub.com).
const SEASON_MEDIA_VERSION = '29bd24c';
// Drawn campaigns have no picture in the app: a navy-to-blue panel per campaign (never red or green, lessons L35).
const PANEL: Record<string, [string, string]> = {
  'black-friday': ['#05070D', '#1B2E4A'],
  'black-friday-soon': ['#05070D', '#24324A'],
  christmas: ['#0B1F4B', '#1D5BBF'],
  'winter-sales': ['#0B1F4B', '#2A6FDB'],
  'new-year-fitness': ['#08111F', '#1D5BBF'],
  'valentines-day': ['#1B1035', '#3B2A6B'],
  halloween: ['#140A2E', '#3D1E60']
};
const DEFAULT_PANEL: [string, string] = ['#08111F', '#1B2E4A'];

/** The campaign slides at the top of the home screen. Nothing moves by itself: the arrows change the slide. */
export function SeasonBanner({ hasDeals, dealsLoaded, onTarget }: {
  hasDeals: boolean; dealsLoaded: boolean; onTarget: (target: Target) => void;
}) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const [index, setIndex] = useState(0);

  // The countdown shows minutes, so the screen updates once a minute, at the full minute.
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 60000 - (Date.now() % 60000) + 50);
    return () => clearTimeout(timer);
  }, [now]);

  const slides = useMemo(() => heroSlides(now), [now]);
  const i = index < slides.length ? index : 0;
  const slide: Slide = slides[i];
  const many = slides.length > 1;
  const go = (step: number) => setIndex((i + step + slides.length) % slides.length);

  let eyebrow = '';
  let title = '';
  let body = '';
  let cta = '';
  let target: Target = 'worlds';
  if (slide.kind === 'season') {
    const season = slide.season;
    const range = `${formatDay(season.start, locale, 'short')} – ${formatDay(season.end, locale, 'short')}`;
    eyebrow = `${t(season.name as TextKey)} · ${range}`;
    title = t(season.title as TextKey);
    const left = countdownParts(season, now);
    body = left ? (left.d > 0 ? t('countdown', left) : t('countdownHours', { h: left.h, m: left.m })) : '';
    if (season.gifts) {
      cta = t('allCta');
      target = 'worlds';
    } else {
      // To the deals, or to the e-mail sign-up when no deal runs (as on the Hub).
      cta = hasDeals || !dealsLoaded ? t('bfCta') : t('soonCta');
      target = hasDeals || !dealsLoaded ? 'deals' : 'newsletter';
    }
  } else {
    const c = slide.campaign;
    eyebrow = t(c.eyebrow as TextKey);
    title = t(c.title as TextKey);
    body = t(c.text as TextKey);
    cta = t(c.cta as TextKey);
    target = c.target === 'deals' && dealsLoaded && !hasDeals ? 'newsletter' : c.target;
  }

  const panel = slide.kind === 'campaign' ? (PANEL[slide.campaign.art] ?? DEFAULT_PANEL) : DEFAULT_PANEL;

  return (
    <View style={s.card} accessibilityRole="summary" accessibilityLabel={t('seasonAria')}>
      {slide.kind === 'season' ? (
        <Image source={{ uri: `${HUB_URL}/seasonal/${slide.season.file}.jpg?v=${SEASON_MEDIA_VERSION}` }}
          style={[StyleSheet.absoluteFill, slide.season.mirror && s.mirror]} contentFit="cover" transition={200}
          accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={panel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {slide.kind === 'season' ? (
        <LinearGradient pointerEvents="none" colors={['rgba(3,10,31,0.1)', 'rgba(3,10,31,0.55)', 'rgba(3,10,31,0.9)']}
          locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={s.body}>
        <Txt style={s.eyebrow}>{eyebrow}</Txt>
        <Txt style={s.title} numberOfLines={3}>{title}</Txt>
        {body ? <Txt style={s.text} numberOfLines={3}>{body}</Txt> : null}
        <View style={s.foot}>
          <Pressable accessibilityRole="button" accessibilityLabel={cta} onPress={() => onTarget(target)}
            style={({ pressed }) => [s.cta, pressed && s.pressed]}>
            <Txt style={s.ctaText} numberOfLines={1}>{cta}</Txt>
            <Ionicons name="arrow-forward" size={16} color={C.onGold} />
          </Pressable>
          {many ? (
            <View style={s.nav}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('prev')} onPress={() => go(-1)} hitSlop={8}
                style={({ pressed }) => [s.round, pressed && s.pressed]}>
                <Ionicons name="chevron-back" size={18} color={C.text} />
              </Pressable>
              <Txt style={s.count} accessibilityLabel={t('slideAria', { n: i + 1, total: slides.length })}>
                {`${i + 1} / ${slides.length}`}
              </Txt>
              <Pressable accessibilityRole="button" accessibilityLabel={t('next')} onPress={() => go(1)} hitSlop={8}
                style={({ pressed }) => [s.round, pressed && s.pressed]}>
                <Ionicons name="chevron-forward" size={18} color={C.text} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { minHeight: 200, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.cardHigh, borderWidth: 1, borderColor: C.border },
  mirror: { transform: [{ scaleX: -1 }] },
  body: { flex: 1, justifyContent: 'flex-end', padding: S.lg, gap: S.xs },
  eyebrow: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1, ...TEXT_ON_PICTURE },
  title: { color: C.text, fontSize: 22, lineHeight: 27, fontWeight: '800', ...TEXT_ON_PICTURE },
  text: { color: C.text, fontSize: 14, lineHeight: 19, ...TEXT_ON_PICTURE },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm, marginTop: S.sm },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.gold, borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: S.lg, flexShrink: 1 },
  ctaText: { color: C.onGold, fontWeight: '800', flexShrink: 1 },
  pressed: { opacity: 0.8 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  round: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,10,31,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  count: { color: C.text, fontWeight: '700', fontSize: 13, ...TEXT_ON_PICTURE }
});
