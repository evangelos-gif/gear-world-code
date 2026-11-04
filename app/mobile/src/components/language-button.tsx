import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { LOCALES } from '@/i18n/core';
import { C, R, S } from '@/theme';

/**
 * The language choice in the top bar, like the language menu of gearworldhub.com: the button shows the language in
 * use ("🌐 Ελληνικά ▾"), and the 11 languages open in a list (owner, 4/11/2026: a gear icon did not say what it is).
 */
export function LanguageButton() {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const top = useSafeAreaInsets().top;
  const current = LOCALES.find(l => l.code === locale)?.name ?? 'English';
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('languageLabel')}: ${current}`} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)} hitSlop={6} style={({ pressed }) => [s.button, pressed && s.pressed]}>
        <Ionicons name="globe-outline" size={18} color={C.gold} />
        <Text style={s.buttonText} numberOfLines={1}>{current}</Text>
        <Ionicons name="chevron-down" size={16} color={C.gold} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => setOpen(false)}>
          <View style={[s.sheet, { marginTop: top + 64 }]} onStartShouldSetResponder={() => true}>
            <ScrollView bounces={false}>
              {LOCALES.map((l, i) => {
                const selected = l.code === locale;
                return (
                  <Pressable key={l.code} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={l.name}
                    onPress={() => { setOpen(false); if (!selected) setLocale(l.code); }}
                    style={({ pressed }) => [s.item, i > 0 && s.line, pressed && s.itemPressed]}>
                    <View style={s.tick}>{selected ? <Ionicons name="checkmark" size={20} color={C.gold} /> : null}</View>
                    <Text style={[s.itemText, selected && s.itemSelected]}>{l.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: S.md, borderRadius: R.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, maxWidth: 170 },
  buttonText: { color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pressed: { opacity: 0.8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(3,10,31,0.6)', alignItems: 'flex-end', paddingHorizontal: S.lg },
  sheet: { width: 240, maxHeight: 580, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.cardHigh, overflow: 'hidden' },
  item: { minHeight: 48, paddingHorizontal: S.md, flexDirection: 'row', alignItems: 'center', gap: S.sm },
  line: { borderTopWidth: 1, borderTopColor: C.border },
  itemPressed: { backgroundColor: C.card },
  tick: { width: 22, alignItems: 'center' },
  itemText: { color: C.text, fontSize: 16 },
  itemSelected: { fontWeight: '800' }
});
