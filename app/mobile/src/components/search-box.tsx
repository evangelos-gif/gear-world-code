import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useI18n } from '@/i18n';
import { encodePhotoParam, type PhotoAnswer } from '@/lib/photo';
import { usePhotoSearch } from '@/lib/use-photo-search';
import { useVoiceSearch } from '@/lib/use-voice-search';
import { C, R, S } from '@/theme';
import { Txt } from './ui';

/** Opens the search screen with what the photo showed (the screen then searches all Gear Worlds). */
const openPhotoResults = (answer: PhotoAnswer) =>
  router.push({ pathname: '/search', params: { q: answer.query, photo: encodePhotoParam(answer) } });

/** Search field, camera (photo search), microphone (voice search in the app's language) and Search button. */
export function SearchBox({ initial = '', placeholder, onSearch, onPhoto = openPhotoResults, autoFocus }: {
  initial?: string; placeholder?: string; onSearch: (q: string) => void; onPhoto?: (answer: PhotoAnswer) => void;
  autoFocus?: boolean;
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

  const photo = usePhotoSearch({ onFound: answer => { setQ(answer.query); setWarn(false); onPhoto(answer); } });

  return (
    <View style={s.wrap}>
      <View style={[s.row, voice.listening && s.rowListening]}>
        <TextInput
          value={q}
          onChangeText={v => { setQ(v); if (warn) setWarn(false); if (voice.message) voice.clearMessage(); if (photo.message) photo.clearMessage(); }}
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('searchButton')} onPress={() => run(q)}
          style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Txt style={s.buttonText}>{t('searchButton')}</Txt>
        </Pressable>
      </View>

      {/* Camera and microphone under the field, each with its name (owner, 4/11/2026: the field was too narrow). */}
      {photo.supported || voice.supported ? (
        <View style={s.tools}>
          {photo.supported ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('photoStart')} accessibilityState={{ busy: photo.busy, disabled: photo.busy }}
              disabled={photo.busy} onPress={() => { voice.clearMessage(); photo.start(); }}
              style={({ pressed }) => [s.tool, pressed && s.pressed]}>
              {photo.busy ? <ActivityIndicator size="small" color={C.gold} /> : <Ionicons name="camera" size={20} color={C.gold} />}
              <Txt style={s.toolText} numberOfLines={1}>{t('photoShort')}</Txt>
            </Pressable>
          ) : null}
          {voice.supported ? (
            <Pressable accessibilityRole="button" accessibilityLabel={voice.listening ? t('voiceStop') : t('voiceStart')}
              accessibilityState={{ busy: voice.listening }} onPress={() => { photo.clearMessage(); voice.toggle(); }}
              style={({ pressed }) => [s.tool, voice.listening && s.toolOn, pressed && s.pressed]}>
              <Ionicons name={voice.listening ? 'stop' : 'mic'} size={20} color={voice.listening ? C.onGold : C.gold} />
              <Txt style={[s.toolText, voice.listening && s.toolTextOn]} numberOfLines={1}>{voice.listening ? t('voiceStop') : t('voiceShort')}</Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {voice.listening ? (
        <View style={s.line} accessibilityLiveRegion="polite">
          <Ionicons name="mic" size={16} color={C.gold} />
          <Txt v="small" style={s.listening}>{t('voiceListening')}</Txt>
        </View>
      ) : null}

      {photo.busy ? (
        <View style={s.line} accessibilityLiveRegion="polite">
          <Ionicons name="camera" size={16} color={C.gold} />
          <Txt v="small" style={s.listening}>{t('photoLooking')}</Txt>
        </View>
      ) : null}

      {!photo.busy && photo.message ? (
        <View style={s.line} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle-outline" size={18} color={C.blue} />
          <View style={s.messageBody}>
            <Txt v="small" style={s.info}>{t(photo.message)}</Txt>
            {photo.message === 'photoBlocked' ? (
              <Pressable accessibilityRole="link" onPress={photo.openSettings} hitSlop={8}>
                <Txt v="small" style={s.link}>{t('voiceOpenSettings')}</Txt>
              </Pressable>
            ) : null}
          </View>
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

    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingLeft: S.lg, minHeight: 54 },
  rowListening: { borderColor: C.gold, borderWidth: 2 },
  input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: S.md, minWidth: 0 },
  tools: { flexDirection: 'row', gap: S.sm },
  tool: { flex: 1, minHeight: 46, borderRadius: R.pill, borderWidth: 1, borderColor: C.gold, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingHorizontal: S.md },
  toolOn: { backgroundColor: C.gold },
  toolText: { color: C.text, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  toolTextOn: { color: C.onGold },
  button: { backgroundColor: C.gold, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', paddingHorizontal: S.lg, borderTopRightRadius: R.md - 1, borderBottomRightRadius: R.md - 1 },
  buttonText: { color: C.onGold, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  messageBody: { flex: 1, gap: S.xs },
  listening: { color: C.gold, fontWeight: '700', flex: 1 },
  info: { color: C.blue },
  link: { color: C.gold, fontWeight: '800', textDecorationLine: 'underline' },
  tipText: { color: C.faint, flex: 1 }
});
