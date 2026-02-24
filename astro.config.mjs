import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'server',
  adapter: vercel(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});