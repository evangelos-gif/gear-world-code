import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { useI18n } from '@/i18n';
import { photoSearch } from './api';
import {
  base64ToBytes, isJpeg, parsePhotoAnswer, photoErrorMessage, shrinkSize,
  PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, type PhotoAnswer, type PhotoMessage
} from './photo';

// Photo search: the person takes a photo or picks one from the gallery. The photo is made smaller here
// (max 1024 px JPEG; re-saving it drops hidden details such as GPS), sent once to the Hub, and never stored.

type Picked = { uri: string; width: number; height: number };

/** One photo as a small JPEG. Tries a second, smaller size if the first is still over 1 MB. */
async function shrink(photo: Picked): Promise<Uint8Array | null> {
  for (const [side, compress] of [[PHOTO_MAX_SIDE, 0.7], [800, 0.5]] as const) {
    const ctx = ImageManipulator.manipulate(photo.uri);
    const size = shrinkSize(photo.width, photo.height, side);
    if (size) ctx.resize(size);
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    const bytes = base64ToBytes(saved.base64 ?? '');
    if (!isJpeg(bytes)) return null;
    if (bytes.length <= PHOTO_MAX_BYTES) return bytes;
  }
  return null;
}

export function usePhotoSearch({ onFound }: { onFound: (answer: PhotoAnswer) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<PhotoMessage | null>(null);
  const running = useRef(false);

  const run = async (source: 'camera' | 'library') => {
    if (running.current) return;
    setMessage(null);
    let picked: ImagePicker.ImagePickerResult;
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setMessage(perm.canAskAgain === false ? 'photoBlocked' : 'photoDenied'); return; }
        picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: false });
      } else {
        picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: false });
      }
    } catch {
      setMessage('photoUnavailable');
      return;
    }
    const asset = picked.canceled ? null : picked.assets?.[0];
    if (!asset?.uri) return;

    running.current = true;
    setBusy(true);
    try {
      const bytes = await shrink({ uri: asset.uri, width: asset.width, height: asset.height }).catch(() => null);
      if (!bytes) { setMessage('photoNotPhoto'); return; }
      const { status, data } = await photoSearch(bytes);
      const answer = status === 200 ? parsePhotoAnswer(data) : null;
      if (answer) onFound(answer);
      else setMessage(photoErrorMessage(status, data));
    } catch {
      setMessage('photoUnavailable');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  /** Asks: take a photo, or choose one from the gallery. */
  const start = () => {
    if (running.current) return;
    // On iPhone the camera or gallery opens a moment after the question closes, or iOS may refuse to show it.
    const later = (source: 'camera' | 'library') => setTimeout(() => { run(source); }, Platform.OS === 'ios' ? 400 : 0);
    Alert.alert(t('photoStart'), t('photoNote'), [
      { text: t('photoTake'), onPress: () => later('camera') },
      { text: t('photoPick'), onPress: () => later('library') },
      { text: t('photoCancel'), style: 'cancel' }
    ]);
  };

  return {
    supported: Platform.OS === 'android' || Platform.OS === 'ios',
    busy,
    message,
    clearMessage: () => setMessage(null),
    start,
    openSettings: () => { Linking.openSettings().catch(() => undefined); }
  };
}
