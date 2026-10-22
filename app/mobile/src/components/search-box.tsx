import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useI18n } from '@/i18n';
import { C, R, S } from '@/theme';
import { Txt } from './ui';

/** Search field + button. Voice search uses the microphone on the phone's keyboard (works in every language). */
export function SearchBox({ initial = '', placeholder, onSearch, autoFocus, showTip }: {
  initial?: string; placeholder?: string; onSearch: (q: string) => void; autoFocus?: boolean; showTip?: boolean;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState(initial);
  const [warn, setWarn] = useState(false);

  const submit = () => {
    const v = q.trim();
    if (v.length < 2) { setWarn(true); return; }
    setWarn(false);
    onSearch(v);
  };

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Ionicons name="search" size={20} color={C.muted} style={s.icon} />
        <TextInput
          value={q}
          onChangeText={v => { setQ(v); if (warn) setWarn(false); }}
          onSubmitEditing={submit}
          placeholder={placeholder ?? t('searchPlaceholder')}
          placeholderTextColor={C.faint}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus={autoFocus}
          maxLength={80}
          accessibilityLabel={placeholder ?? t('searchPlaceholder')}
          style={s.input}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('searchButton')} onPress={submit}
          style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Txt style={s.buttonText}>{t('searchButton')}</Txt>
        </Pressable>
      </View>
      {warn ? <Txt v="small" style={s.warn} accessibilityLiveRegion="polite">{t('min2')}</Txt> : null}
      {showTip && !warn ? (
        <View style={s.tip}>
          <Ionicons name="mic-outline" size={16} color={C.faint} />
          <Txt v="small" style={s.tipText}>{t('voiceTip')}</Txt>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingLeft: S.md, minHeight: 54 },
  icon: { marginRight: S.sm },
  input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: S.md, minWidth: 0 },
  button: { backgroundColor: C.gold, alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: S.lg, borderTopRightRadius: R.md - 1, borderBottomRightRadius: R.md - 1 },
  pressed: { opacity: 0.8 },
  buttonText: { color: C.onGold, fontWeight: '800' },
  warn: { color: C.blue },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { color: C.faint, flex: 1 }
});
