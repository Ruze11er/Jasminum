import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

const pink = '#F47FA6';

/*
 * Icons for every platform, plus iOS launch ("splash") screens. iOS doesn't build a
 * splash screen from the manifest the way Android does, so it needs an image per screen
 * size. One per current device size, in light and dark. They're excluded from the offline
 * precache (iOS stores them itself when the app is added to the home screen).
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: combinePresetAndAppleSplashScreens(
    {
      ...minimal2023Preset,
      maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: pink } },
      apple: { ...minimal2023Preset.apple, resizeOptions: { background: pink } },
    },
    {
      padding: 0.35,
      resizeOptions: { background: '#FFFBFC', fit: 'contain' },
      darkResizeOptions: { background: '#1E1519', fit: 'contain' },
      linkMediaOptions: { log: false, addMediaScreen: true, basePath: '/', xhtml: false },
      // Flat colors and one icon: a small palette keeps each image tiny.
      png: { compressionLevel: 9, palette: true, quality: 80, colors: 64 },
    },
    [
      'iPhone 17 Pro Max',
      'iPhone 17 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 16e',
      'iPhone 13 mini',
      'iPhone 11',
      'iPhone 8 Plus',
      'iPhone SE 4.7"',
      'iPad 11"',
      'iPad Air 11"',
      'iPad Pro 12.9"',
    ],
  ),
  images: ['public/icon.svg'],
});
