import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// Pokepedia Production Build - Cloudflare Edge Edition
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'server',
  adapter: cloudflare(),
  integrations: [],
  vite: {
    plugins: [tailwindcss()]
  }
});