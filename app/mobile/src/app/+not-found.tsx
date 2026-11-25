import { router } from 'expo-router';

import { ErrorBox, Screen, TopBar } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Screen>
      <TopBar />
      <ErrorBox message={t('productMissing')} onRetry={() => router.replace('/')} />
    </Screen>
  );
}
