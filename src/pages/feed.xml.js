import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

export async function GET(context) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  return rss({
    title: 'Ben Asher',
    description: "Ben Asher's personal website and blog",
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: `/${p.id}/`,
      content: marked.parse(p.body ?? ''),
    })),
    customData: '<language>en-us</language>',
  });
}