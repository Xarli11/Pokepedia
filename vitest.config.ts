/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// getViteConfig wires up the Astro Vite plugin so .astro components can be
// imported directly in tests (needed for Container-API SSR regression
// tests — see src/components/*.container.test.ts).
//
// Deliberately NOT loading astro.config.mjs (configFile: false): its
// Cloudflare adapter spins up KV/platform-proxy emulation that never tears
// down cleanly under Vitest's Vite server, adding a ~10s hang to every test
// run. Tests only need the Astro compiler + Tailwind Vite plugin, not the
// production adapter.
export default getViteConfig(
  {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    configFile: false,
    site: 'https://pokepedia.app',
    trailingSlash: 'always',
    vite: { plugins: [tailwindcss()] },
  }
);
