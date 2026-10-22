import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { C, R, S } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'body' | 'muted' | 'small' | 'title' | 'h2' | 'eyebrow' | 'label';
export function Txt({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  return <Text {...rest} style={[t.base, t[v], style]} />;
}

export function Button({ label, onPress, icon, kind = 'primary', disabled, busy, style, hint }: {
  label: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'secondary'; disabled?: boolean; busy?: boolean;
  style?: StyleProp<ViewStyle>; hint?: string;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [b.base, primary ? b.primary : b.secondary, (disabled || busy) && b.disabled, pressed && b.pressed, style]}>
      {busy ? <ActivityIndicator color={primary ? C.onGold : C.text} /> : null}
      {!busy && icon ? <Ionicons name={icon} size={20} color={primary ? C.onGold : C.gold} /> : null}
      <Text style={[b.label, primary ? b.labelPrimary : b.labelSecondary]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [ch.base, selected && ch.selected, pressed && b.pressed]}>
      {selected ? <Ionicons name="checkmark" size={16} color={C.onGold} /> : null}
      <Text style={[ch.label, selected && ch.labelSelected]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [ib.base, pressed && b.pressed]}>
      <Ionicons name={icon} size={24} color={C.text} />
    </Pressable>
  );
}

/** Top bar with a back button. The Stack header is hidden, so every screen draws its own bar (same on iOS and Android). */
export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <View style={tb.bar}>
      <IconButton icon="chevron-back" label={t('back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Txt v="label" style={tb.title} numberOfLines={1}>{title ?? ''}</Txt>
      <View style={tb.right}>{right}</View>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={st.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={C.gold} />
      {label ? <Txt v="muted" style={st.centerText}>{label}</Txt> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={st.box} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={28} color={C.blue} />
      <Txt style={st.centerText}>{message}</Txt>
      {onRetry ? <Button kind="secondary" icon="refresh" label={t('retry')} onPress={onRetry} /> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={cb.row}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={26} color={checked ? C.gold : C.muted} />
      <Txt v="muted" style={cb.label}>{label}</Txt>
    </Pressable>
  );
}

const t = StyleSheet.create({
  base: { color: C.text, fontSize: 16, lineHeight: 23 },
  body: {},
  muted: { color: C.muted },
  small: { color: C.muted, fontSize: 14, lineHeight: 20 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  eyebrow: { color: C.gold, fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 1.2 },
  label: { fontSize: 17, lineHeight: 22, fontWeight: '700' }
});

const b = StyleSheet.create({
  base: { minHeight: 50, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  primary: { backgroundColor: C.gold },
  secondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: C.gold },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  label: { fontSize: 16, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  labelPrimary: { color: C.onGold },
  labelSecondary: { color: C.text }
});

const ch = StyleSheet.create({
  base: { minHeight: 40, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  selected: { backgroundColor: C.gold, borderColor: C.gold },
  label: { color: C.text, fontSize: 15, fontWeight: '600' },
  labelSelected: { color: C.onGold, fontWeight: '800' }
});

const ib = StyleSheet.create({
  base: { width: 44, height: 44, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card }
});

const tb = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgDeep },
  title: { flex: 1 },
  right: { minWidth: 44, alignItems: 'flex-end' }
});

const st = StyleSheet.create({
  center: { padding: S.xxl, alignItems: 'center', justifyContent: 'center', gap: S.md },
  centerText: { textAlign: 'center' },
  box: { margin: S.lg, padding: S.xl, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: S.md }
});

const cb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: S.sm, minHeight: 44 },
  label: { flex: 1 }
});
