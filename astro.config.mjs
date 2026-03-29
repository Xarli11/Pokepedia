import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// Pokepedia Production Build - Cloudflare Edge Edition
export default defineConfig({
  site: 'https://pokepedia.app',
  output: 'static', // Astro 5+: 'static' ahora maneja el comportamiento híbrido por defecto
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
