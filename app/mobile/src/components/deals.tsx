import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { formatDay, formatMoney } from '@/lib/format';
import { openInBrowser } from '@/lib/open';
import { campaignLabel, type Deal } from '@/lib/seasons';
import { C, R, S } from '@/theme';
import { Txt } from './ui';

/**
 * This week's deals, from the Hub (each with its end date). The button opens the retailer page of a Gear World
 * site in the phone's browser, where the code is shown: the app never shows a code and never opens /go/ or /out/.
 */
export function Deals({ deals, day, compact }: { deals: Deal[]; day: string; compact?: boolean }) {
  const { t, locale } = useI18n();
  if (!deals.length) return null;
  if (compact) return <CompactDeals deals={deals} day={day} />;
  return (
    <View style={s.wrap}>
      <Txt v="h2">{t('dealsTitle')}</Txt>
      <Txt v="muted">{t('dealsSub')}</Txt>
      <View style={s.list}>
        {deals.map(d => {
          const offer = d.kind === 'code'
            ? (d.minSpend > 0
              ? t('dealCode', { off: formatMoney(d.off, d.currency, locale), min: formatMoney(d.minSpend, d.currency, locale) })
              : t('dealCodeNoMin', { off: formatMoney(d.off, d.currency, locale) }))
            : t('dealUpTo', { pct: d.upTo });
          const label = campaignLabel(d, day);
          const meta = `${d.kind === 'code' ? t('dealWithCode') : t('dealSale')}${label ? ` · ${label}` : ''}`;
          return (
            <Pressable key={d.id} accessibilityRole="link" accessibilityLabel={`${d.retailer}. ${offer}. ${t('dealUntil', { date: formatDay(d.end, locale) })}`}
              accessibilityHint={t('opensBrowser')} onPress={() => openInBrowser(d.link)}
              style={({ pressed }) => [s.card, pressed && s.pressed]}>
              <View style={s.top}>
                <Txt style={s.shop} numberOfLines={1}>{d.retailer}</Txt>
                <Txt v="small" style={s.end}>{t('dealUntil', { date: formatDay(d.end, locale) })}</Txt>
              </View>
              <Txt style={s.offer}>{offer}</Txt>
              <Txt v="small" style={s.meta}>{meta}</Txt>
              {d.sites.length ? <Txt v="small" style={s.worlds}>{d.sites.join(' · ')}</Txt> : null}
              <View style={s.ctaRow}>
                <Txt style={s.cta}>{t('dealCta')}</Txt>
                <Ionicons name="open-outline" size={16} color={C.gold} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The deals of one Gear World, one short line each, on that world's page. */
function CompactDeals({ deals, day }: { deals: Deal[]; day: string }) {
  const { t, locale } = useI18n();
  return (
    <View style={s.compact}>
      <View style={s.compactHead}>
        <Ionicons name="pricetag-outline" size={18} color={C.gold} />
        <Txt style={s.compactTitle}>{t('navDeals')}</Txt>
      </View>
      {deals.map((d, i) => {
        const offer = offerText(d, t, locale);
        const until = t('dealUntil', { date: formatDay(d.end, locale, 'short') });
        const label = campaignLabel(d, day);
        return (
          <Pressable key={d.id} accessibilityRole="link" accessibilityLabel={`${d.retailer}. ${offer}. ${until}`}
            accessibilityHint={t('opensBrowser')} onPress={() => openInBrowser(d.link)}
            style={({ pressed }) => [s.compactRow, i > 0 && s.compactLine, pressed && s.pressed]}>
            <View style={s.flex}>
              <Txt style={s.compactOffer}>{offer}</Txt>
              <Txt v="small" style={s.meta}>{[d.retailer, label, until].filter(Boolean).join(' · ')}</Txt>
            </View>
            <Ionicons name="open-outline" size={18} color={C.gold} />
          </Pressable>
        );
      })}
    </View>
  );
}

function offerText(d: Deal, t: ReturnType<typeof useI18n>['t'], locale: string): string {
  if (d.kind !== 'code') return t('dealUpTo', { pct: d.upTo });
  return d.minSpend > 0
    ? t('dealCode', { off: formatMoney(d.off, d.currency, locale), min: formatMoney(d.minSpend, d.currency, locale) })
    : t('dealCodeNoMin', { off: formatMoney(d.off, d.currency, locale) });
}

const s = StyleSheet.create({
  compact: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderLeftColor: C.gold, paddingHorizontal: S.lg, paddingVertical: S.sm },
  compactHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  compactTitle: { color: C.text, fontWeight: '800' },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  compactLine: { borderTopWidth: 1, borderTopColor: C.border },
  compactOffer: { color: C.gold, fontWeight: '800', fontSize: 15, lineHeight: 20 },
  flex: { flex: 1, gap: 2 },
  wrap: { gap: S.sm },
  list: { gap: S.md, marginTop: S.xs },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, gap: S.xs, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderLeftColor: C.gold },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: S.sm },
  shop: { color: C.text, fontWeight: '800', flexShrink: 1 },
  end: { color: C.muted },
  offer: { color: C.gold, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  meta: { color: C.muted },
  worlds: { color: C.faint, letterSpacing: 0.5 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: S.xs },
  cta: { color: C.gold, fontWeight: '800' }
});
