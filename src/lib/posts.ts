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

// Plain-text preview taken from the opening of the post itself, so the index
// shows the writing rather than the frontmatter's SEO summary. Strips the
// constructs that would read as noise out of context (comments, code fences,
// images, headings, list markers, link syntax) and cuts on a sentence boundary
// where one is available, so previews don't end mid-clause.
export function excerpt(body: string | undefined, maxChars = 180): string {
  if (!body) return '';

  let text = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s{0,3}>\s?/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\d+\.\s+/gm, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();

  // a co-author credit reads as a stray fragment when lifted into a row
  text = text.replace(/^Co-authored by [^.]+\.?\s*/i, '').trim();

  if (text.length <= maxChars) return text;

  const window = text.slice(0, maxChars);
  const sentence = window.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (sentence && sentence[0].length > maxChars * 0.55) {
    return sentence[0].trim();
  }
  return `${window.slice(0, window.lastIndexOf(' ')).trim()}…`;
}
