import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// Pokepedia Production Build - Cloudflare Edge Edition
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'server',
  adapter: cloudflare(),
  image: {
    service: { entrypoint: 'astro/assets/services/noop' }
  },
  integrations: [],
  vite: {
    plugins: [tailwindcss()]
  }
});
// Cloudflare Compatibility Active
