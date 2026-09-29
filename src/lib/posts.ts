import { getCollection } from 'astro:content';

// All posts, newest first — the one sort shared by the homepage and the feed.
export async function sortedPosts() {
  return (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

// minutes.html port: (words >= 250) ? floor(words / 180) : null
export function readMinutes(body: string): number | null {
  const words = body.trim().split(/\s+/).length;
  return words >= 250 ? Math.floor(words / 180) : null;
}
