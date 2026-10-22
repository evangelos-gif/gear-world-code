import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { isValidEmail, subscribe } from '@/lib/api';
import { useI18n } from '@/i18n';
import { C, R, S } from '@/theme';
import { Button, Checkbox, Txt } from './ui';

/** Same form, texts and consent as the newsletter on gearworldhub.com. */
export function Newsletter() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [message, setMessage] = useState('');

  const send = async () => {
    if (!isValidEmail(email)) { setMessage(t('nl_invalid')); return; }
    if (!consent) { setMessage(t('nl_consentRequired')); return; }
    setState('busy');
    setMessage(t('nl_sending'));
    try {
      await subscribe(email, locale);
      setState('done');
      setMessage(t('nl_success'));
    } catch {
      setState('idle');
      setMessage(t('nl_error'));
    }
  };

  return (
    <View style={s.box}>
      <Txt v="eyebrow">{t('nl_eyebrow')}</Txt>
      <Txt v="h2">{t('nl_title')}</Txt>
      <Txt v="muted">{t('nl_description')}</Txt>
      {state === 'done' ? (
        <Txt style={s.done} accessibilityLiveRegion="polite">{message}</Txt>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('nl_emailPlaceholder')}
            placeholderTextColor={C.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel={t('nl_emailLabel')}
            maxLength={254}
            style={s.input}
          />
          <Checkbox checked={consent} onChange={setConsent} label={t('nl_consent')} />
          <Button label={t('nl_button')} icon="mail-outline" onPress={send} busy={state === 'busy'} />
          {message ? <Txt v="small" style={s.msg} accessibilityLiveRegion="polite">{message}</Txt> : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.lg, gap: S.md },
  input: { minHeight: 50, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, color: C.text, fontSize: 16, paddingHorizontal: S.md },
  msg: { color: C.blue },
  done: { color: C.text, fontWeight: '700' }
});
