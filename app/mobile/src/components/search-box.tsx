import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useVoiceSearch } from '@/lib/use-voice-search';
import { C, R, S } from '@/theme';
import { Txt } from './ui';

/** Search field, microphone (voice search in the app's language) and Search button. */
export function SearchBox({ initial = '', placeholder, onSearch, autoFocus, showTip }: {
  initial?: string; placeholder?: string; onSearch: (q: string) => void; autoFocus?: boolean; showTip?: boolean;
}) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState(initial);
  const [warn, setWarn] = useState(false);

  const run = (value: string) => {
    const v = value.trim();
    if (v.length < 2) { setWarn(true); return; }
    setWarn(false);
    onSearch(v);
  };

  const voice = useVoiceSearch({
    lang: locale,
    onText: text => { setQ(text); setWarn(false); },
    onDone: text => { setQ(text); run(text); }
  });

  return (
    <View style={s.wrap}>
      <View style={[s.row, voice.listening && s.rowListening]}>
        <TextInput
          value={q}
          onChangeText={v => { setQ(v); if (warn) setWarn(false); if (voice.message) voice.clearMessage(); }}
          onSubmitEditing={() => run(q)}
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
        {voice.supported ? (
          <Pressable accessibilityRole="button" accessibilityLabel={voice.listening ? t('voiceStop') : t('voiceStart')}
            accessibilityState={{ busy: voice.listening }} onPress={voice.toggle} hitSlop={6}
            style={({ pressed }) => [s.mic, voice.listening && s.micOn, pressed && s.pressed]}>
            <Ionicons name={voice.listening ? 'stop' : 'mic'} size={22} color={voice.listening ? C.onGold : C.gold} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('searchButton')} onPress={() => run(q)}
          style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Txt style={s.buttonText}>{t('searchButton')}</Txt>
        </Pressable>
      </View>

      {voice.listening ? (
        <View style={s.line} accessibilityLiveRegion="polite">
          <Ionicons name="mic" size={16} color={C.gold} />
          <Txt v="small" style={s.listening}>{t('voiceListening')}</Txt>
        </View>
      ) : null}

      {!voice.listening && voice.message ? (
        <View style={s.line} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle-outline" size={18} color={C.blue} />
          <View style={s.messageBody}>
            <Txt v="small" style={s.info}>{t(voice.message)}</Txt>
            {voice.message === 'voiceBlocked' ? (
              <Pressable accessibilityRole="link" onPress={voice.openSettings} hitSlop={8}>
                <Txt v="small" style={s.link}>{t('voiceOpenSettings')}</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {warn ? <Txt v="small" style={s.info} accessibilityLiveRegion="polite">{t('min2')}</Txt> : null}

      {showTip && voice.supported && !warn && !voice.message && !voice.listening ? (
        <View style={s.line}>
          <Ionicons name="mic-outline" size={16} color={C.faint} />
          <Txt v="small" style={s.tipText}>{t('voiceTip')}</Txt>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingLeft: S.lg, minHeight: 54 },
  rowListening: { borderColor: C.gold, borderWidth: 2 },
  input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: S.md, minWidth: 0 },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginHorizontal: S.xs, borderWidth: 1, borderColor: C.border },
  micOn: { backgroundColor: C.gold, borderColor: C.gold },
  button: { backgroundColor: C.gold, alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: S.lg, borderTopRightRadius: R.md - 1, borderBottomRightRadius: R.md - 1 },
  pressed: { opacity: 0.8 },
  buttonText: { color: C.onGold, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  messageBody: { flex: 1, gap: S.xs },
  listening: { color: C.gold, fontWeight: '700', flex: 1 },
  info: { color: C.blue },
  link: { color: C.gold, fontWeight: '800', textDecorationLine: 'underline' },
  tipText: { color: C.faint, flex: 1 }
});
