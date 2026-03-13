import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// Pokepedia Production Build - 2026-03-13
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'server',
  adapter: vercel(),
  integrations: [],
  vite: {
    plugins: [tailwindcss()]
  }
});