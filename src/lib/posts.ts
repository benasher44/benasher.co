import { getCollection } from 'astro:content';

// All posts, newest first — the one sort shared by the homepage and the feed.
export async function sortedPosts() {
  return (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}
