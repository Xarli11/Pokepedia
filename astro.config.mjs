import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// Pokepedia Clean Build - Cloudflare Pages Edition
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'server',
  adapter: cloudflare(),
  trailingSlash: 'always',
  build: {
    format: 'directory'
  },
  image: {
    service: { entrypoint: 'astro/assets/services/noop' }
  },
  integrations: [],
  vite: {
    plugins: [tailwindcss()]
  }
});
