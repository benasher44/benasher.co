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
    // code blocks stay dark in both page themes (see main.css: pre background);
    // high-contrast variant keeps even comment grays WCAG-AA on near-black.
    // themes + defaultColor:false make shiki emit --shiki-* css variables
    // instead of inline colors/background — main.css needs no !important.
    shikiConfig: {
      themes: {
        light: 'github-dark-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      defaultColor: false,
    },
  },
});
