import rss from '@astrojs/rss';
import { marked } from 'marked';
import { sortedPosts } from '../lib/posts';
import { SITE_NAME, SITE_DESCRIPTION } from '../lib/site';

export async function GET(context) {
  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: (await sortedPosts()).map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: `/${p.id}/`,
      content: marked.parse(p.body ?? ''),
    })),
    customData: '<language>en-us</language>',
  });
}