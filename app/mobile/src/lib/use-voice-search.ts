import { requireOptionalNativeModule } from 'expo';
import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { transcriptOf, voiceErrorMessage, voiceOptions, type VoiceMessage } from './voice';

// The phone's own speech service (Google on Android, Apple on iOS) turns speech into text.
// The app never records or keeps audio. Expo Go has no speech module, so there the microphone button is hidden.

type Subscription = { remove: () => void };
type SpeechModule = {
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  start: (options: ReturnType<typeof voiceOptions>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (event: string, listener: (event: unknown) => void) => Subscription;
};

let cachedModule: SpeechModule | null | undefined;

function speechModule(): SpeechModule | null {
  if (cachedModule !== undefined) return cachedModule;
  cachedModule = null;
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      cachedModule = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');
    } catch {
      cachedModule = null;
    }
  }
  return cachedModule;
}

const quiet = (fn: () => void) => { try { fn(); } catch { /* the recogniser was already stopped */ } };

// Screens in the stack stay mounted, so several search boxes can exist at once.
// Only the box that started listening reacts to the speech events, and it stops when its screen is left.
let owner: object | null = null;

export function useVoiceSearch({ lang, onText, onDone }: {
  lang: string;
  onText: (text: string) => void;
  onDone: (text: string) => void;
}) {
  const mod = speechModule();
  const [me] = useState(() => ({}));
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<VoiceMessage | null>(null);
  const heard = useRef('');
  const finished = useRef(false);
  const focused = useIsFocused();

  const handle = useEffectEvent((name: string, event: unknown) => {
    if (owner !== me) return;
    if (name === 'start') {
      setListening(true);
    } else if (name === 'result') {
      const { text, isFinal } = transcriptOf(event);
      if (text) { heard.current = text; onText(text); }
      if (isFinal && text && !finished.current) { finished.current = true; onDone(text); }
    } else if (name === 'nomatch') {
      if (!heard.current) setMessage('voiceNoSpeech');
    } else if (name === 'error') {
      const msg = voiceErrorMessage((event as { error?: unknown } | null)?.error);
      if (msg) { finished.current = true; setMessage(msg); }
    } else if (name === 'end') {
      owner = null;
      setListening(false);
      if (!finished.current && heard.current) { finished.current = true; onDone(heard.current); }
    }
  });

  // Leaving the screen (or the app closing it) stops listening at once.
  useEffect(() => {
    if (focused || !mod || owner !== me) return;
    owner = null;
    setListening(false);
    quiet(() => mod.abort());
  }, [focused, mod, me]);

  useEffect(() => {
    if (!mod) return undefined;
    const subs = ['start', 'result', 'nomatch', 'error', 'end'].map(name => mod.addListener(name, e => handle(name, e)));
    return () => {
      subs.forEach(s => s.remove());
      if (owner === me) { owner = null; quiet(() => mod.abort()); }
    };
  }, [mod, me]);

  const toggle = async () => {
    if (!mod) return;
    if (owner === me) { quiet(() => mod.stop()); return; }
    setMessage(null);
    if (owner) { quiet(() => mod.abort()); owner = null; }
    let available = false;
    try { available = mod.isRecognitionAvailable(); } catch { available = false; }
    if (!available) { setMessage('voiceUnavailable'); return; }
    const perm = await mod.requestPermissionsAsync().catch(() => null);
    if (!perm || !perm.granted) { setMessage(perm && perm.canAskAgain === false ? 'voiceBlocked' : 'voiceDenied'); return; }
    owner = me;
    heard.current = '';
    finished.current = false;
    setListening(true);
    try {
      mod.start(voiceOptions(lang));
    } catch {
      owner = null;
      setListening(false);
      setMessage('voiceFailed');
    }
  };

  return {
    supported: mod !== null,
    listening,
    message,
    clearMessage: () => setMessage(null),
    toggle,
    openSettings: () => { Linking.openSettings().catch(() => undefined); }
  };
}
