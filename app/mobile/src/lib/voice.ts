// Voice search helpers without React or native code, so they can be tested with plain Node.

export type VoiceMessage =
  | 'voiceDenied' | 'voiceBlocked' | 'voiceNoSpeech' | 'voiceLanguage' | 'voiceUnavailable' | 'voiceFailed';

/** Turns a speech recognition error code into the message the person sees. `null` = say nothing (they stopped it). */
export function voiceErrorMessage(code: unknown): VoiceMessage | null {
  switch (String(code ?? '')) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'voiceDenied';
    case 'no-speech':
    case 'speech-timeout':
    case 'nomatch':
      return 'voiceNoSpeech';
    case 'language-not-supported':
      return 'voiceLanguage';
    case 'service-not-allowed':
      return 'voiceUnavailable';
    default:
      return 'voiceFailed';
  }
}

/** What was heard, made ready for the search box: one line, no full stop at the end, at most 80 characters. */
export function cleanTranscript(text: unknown): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.。!?！？,;:…]+$/u, '')
    .slice(0, 80)
    .trim();
}

/** The first transcript of a speech recognition `result` event (the event shape is checked, never trusted). */
export function transcriptOf(event: unknown): { text: string; isFinal: boolean } {
  const e = (event ?? {}) as { isFinal?: unknown; results?: unknown };
  const first = Array.isArray(e.results) ? (e.results[0] as { transcript?: unknown } | undefined) : undefined;
  return { text: cleanTranscript(first?.transcript), isFinal: e.isFinal === true };
}

/** Options for one voice search: the app's language, live text while speaking, stop after one phrase. */
export function voiceOptions(lang: string) {
  return {
    lang,
    interimResults: true,
    continuous: false,
    maxAlternatives: 1,
    addsPunctuation: false,
    iosTaskHint: 'search',
    androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' }
  } as const;
}
