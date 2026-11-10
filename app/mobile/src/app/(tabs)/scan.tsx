import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { gtinForms, PRODUCT_BARCODES } from '@/lib/barcode';
import { C, MAX_WIDTH, R, S } from '@/theme';

/**
 * The barcode scanner (version 1.0.1). The camera reads the barcode on the phone (no picture is taken or sent);
 * only its digits go to the results screen, which asks the Hub for the same product in every Gear World.
 * The camera runs only while this tab is on screen.
 */
export default function ScanScreen() {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [typed, setTyped] = useState('');
  const [invalid, setInvalid] = useState(false);
  const busy = useRef(false);

  useFocusEffect(useCallback(() => {
    busy.current = false;
    setActive(true);
    return () => setActive(false);
  }, []));

  const open = (code: string, type = '') => {
    const forms = gtinForms(code, type);
    if (!forms.length) { setInvalid(true); return false; }
    setInvalid(false);
    router.push({ pathname: '/barcode', params: { code: forms[0] } });
    return true;
  };

  const onScanned = (r: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    if (open(r.data, r.type)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else {
      // Not a product barcode: try again after a moment.
      setTimeout(() => { busy.current = false; }, 1500);
    }
  };

  const granted = permission?.granted === true;
  const blocked = permission !== null && !permission.granted && !permission.canAskAgain;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <Txt v="title">{t('scanTitle')}</Txt>
          <Txt v="muted">{t('scanHelp')}</Txt>

          <View style={s.cameraBox}>
            {granted && active ? (
              <CameraView style={StyleSheet.absoluteFill} facing="back"
                barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODES] }}
                onBarcodeScanned={onScanned} accessibilityLabel={t('scanTitle')} />
            ) : (
              <View style={s.askBox}>
                <Ionicons name="barcode-outline" size={56} color={C.gold} />
                <Txt style={s.center}>{blocked ? t('photoBlocked') : t('scanWhy')}</Txt>
                {blocked
                  ? <Button kind="secondary" icon="settings-outline" label={t('voiceOpenSettings')} onPress={() => { Linking.openSettings().catch(() => undefined); }} />
                  : <Button icon="camera" label={t('scanAllow')} onPress={() => { requestPermission().catch(() => undefined); }} />}
              </View>
            )}
            {granted && active ? <View pointerEvents="none" style={s.frame} /> : null}
          </View>

          <Txt v="label">{t('scanType')}</Txt>
          <View style={s.row}>
            <TextInput value={typed} onChangeText={v => { setTyped(v.replace(/[^\d\s-]/g, '')); setInvalid(false); }}
              onSubmitEditing={() => open(typed)} keyboardType="number-pad" returnKeyType="search" maxLength={20}
              placeholder="5012345678900" placeholderTextColor={C.faint} accessibilityLabel={t('scanType')} style={s.input} />
            <Button label={t('scanFind')} onPress={() => open(typed)} style={s.find} />
          </View>
          {invalid ? <Txt v="small" style={s.info} accessibilityLiveRegion="polite">{t('scanInvalid')}</Txt> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: S.xl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: S.lg, gap: S.md },
  cameraBox: { height: 320, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  askBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.lg },
  center: { textAlign: 'center' },
  frame: { position: 'absolute', left: '12%', right: '12%', top: '32%', bottom: '32%', borderWidth: 3, borderColor: C.gold, borderRadius: R.md },
  row: { flexDirection: 'row', gap: S.sm, alignItems: 'stretch' },
  input: { flex: 1, minWidth: 0, minHeight: 50, color: C.text, fontSize: 18, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.md, letterSpacing: 1 },
  find: { flexShrink: 0, paddingHorizontal: S.md },
  info: { color: C.blue }
});
