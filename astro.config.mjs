// @ts-check
import { defineConfig } from 'astro/config';
import purgecss from 'astro-purgecss';
import { SITE_URL } from './src/lib/site';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  build: {
    format: 'directory',
  },
  integrations: [
    // strip unused selectors from the bundled css against the built html
    purgecss(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
