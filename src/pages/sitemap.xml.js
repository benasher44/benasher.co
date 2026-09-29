// Hand-rolled sitemap at the same /sitemap.xml URL jekyll-sitemap used.
// Skips the old /404/ entry (quirk of jekyll-sitemap listing the 404 page).
import { getCollection } from 'astro:content';
import { SITE_URL } from '../lib/site';

export async function GET() {
  const posts = await getCollection('blog');
  const urls = ['/', '/about/', ...posts.map((p) => `/${p.id}/`)];

  const body = urls
    .map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}