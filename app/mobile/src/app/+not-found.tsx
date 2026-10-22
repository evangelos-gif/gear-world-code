import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBox, TopBar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { C } from '@/theme';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TopBar />
      <ErrorBox message={t('productMissing')} onRetry={() => router.replace('/')} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg } });
