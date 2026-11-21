import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Product } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useI18n } from '@/i18n';
import { C, R, S } from '@/theme';
import { Txt } from './ui';

export function StockLine({ inStock, size = 'small' }: { inStock: boolean | null; size?: 'small' | 'body' }) {
  const { t } = useI18n();
  if (inStock === null) return null;
  // Icon + words, never colour alone.
  return (
    <View style={s.stock}>
      <Ionicons name={inStock ? 'checkmark-circle' : 'close-circle-outline'} size={size === 'small' ? 16 : 20} color={inStock ? C.blue : C.faint} />
      <Txt v={size === 'small' ? 'small' : 'body'} style={{ color: inStock ? C.text : C.faint }}>{inStock ? t('inStock') : t('outOfStock')}</Txt>
    </View>
  );
}

export function ProductCard({ product, showWorld }: { product: Product; showWorld?: boolean }) {
  const { locale } = useI18n();
  const price = formatPrice(product.price, product.currency, locale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}. ${price}. ${product.retailer}`}
      onPress={() => router.push({ pathname: '/product', params: { key: product.key } })}
      style={({ pressed }) => [s.card, pressed && s.pressed]}>
      <View style={s.imageBox}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={s.image} contentFit="contain" transition={150} recyclingKey={product.key} />
        ) : <Ionicons name="storefront-outline" size={36} color={C.faint} />}
      </View>
      <View style={s.body}>
        {showWorld ? <Txt style={s.world} numberOfLines={1}>{product.worldKey}</Txt> : null}
        <Txt style={s.name} numberOfLines={3}>{product.name}</Txt>
        {price ? <Txt style={s.price}>{price}</Txt> : null}
        {product.retailer ? <Txt v="small" numberOfLines={1}>{product.retailer}</Txt> : null}
        <StockLine inStock={product.inStock} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  imageBox: { height: 150, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  body: { padding: S.md, gap: 4, flex: 1 },
  world: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 2 },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 4 }
});
