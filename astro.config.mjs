import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// Pokepedia Production Build - 2026-03-13 v2
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'server',
  adapter: cloudflare(),
  integrations: [],
  vite: {
    plugins: [tailwindcss()]
  }
});