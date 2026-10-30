import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const pink = '#F47FA6';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: pink } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: pink } },
  },
  images: ['public/icon.svg'],
});
