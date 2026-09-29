// @ts-check
import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/lib/site';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  build: {
    format: 'directory',
  },
  markdown: {
    // code blocks stay dark in both themes (see main.css: pre background);
    // high-contrast variant keeps even comment grays WCAG-AA on near-black
    shikiConfig: {
      theme: 'github-dark-high-contrast',
    },
  },
});
