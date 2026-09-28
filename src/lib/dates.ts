// Date helpers matching Jekyll's rendering (site timezone America/Los_Angeles)

// US DST rule (2007+): 2nd Sunday of March .. 1st Sunday of November
export function laOffset(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const sundays = (month: number, maxDay: number): number[] => {
    const out: number[] = [];
    for (let d = 1; d <= maxDay; d++) {
      if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) out.push(d);
    }
    return out;
  };
  const secondSundayMarch = sundays(3, 14)[1];
  const firstSundayNov = sundays(11, 7)[0];
  const inDst =
    (month > 3 && month < 11) ||
    (month === 3 && day >= secondSundayMarch) ||
    (month === 11 && day < firstSundayNov);
  return inDst ? '-07:00' : '-08:00';
}

// Serialize a Date as Jekyll would render its front-matter datetime:
// midnight site-local, ISO with LA offset. Post dates arrive as
// UTC midnight-shifted Dates (2020-02-09T08:00Z for PST midnight).
export function laIso(date: Date): string {
  const offset = laOffset(date);
  const hours = offset === '-07:00' ? 7 : 8;
  const local = new Date(date.getTime() - hours * 3600 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00${offset}`;
}

// Liquid's date_to_string: "09 Feb 2020"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateString(date: Date): string {
  const offset = laOffset(date);
  const hours = offset === '-07:00' ? 7 : 8;
  const local = new Date(date.getTime() - hours * 3600 * 1000);
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}

// Liquid "%b %e, %Y" (footer "last updated"): "Sep 28, 2026"
export function formatShortDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}