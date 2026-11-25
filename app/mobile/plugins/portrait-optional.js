// Version 1.0.2: the app is drawn upright only (orientation "portrait"), which makes Google Play think it needs a
// phone that can stand upright and hides it from some Chromebooks and Android XR glasses (Play warning, 22/11/2026).
// Saying the upright screen is optional keeps the app upright on every phone and lets those devices install it.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withPortraitOptional(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] || []).filter(f => !(f.$ && f.$['android:name'] === FEATURE));
    features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    manifest['uses-feature'] = features;
    return cfg;
  });
};
