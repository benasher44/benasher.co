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

// Calendar parts of a Date in site-local time. Post dates arrive as
// UTC midnight-shifted Dates (2020-02-09T08:00Z for PST midnight).
function laParts(date: Date) {
  const offset = laOffset(date);
  const hours = offset === '-07:00' ? 7 : 8;
  const local = new Date(date.getTime() - hours * 3600 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    offset,
  };
}

// Serialize a Date as Jekyll would render its front-matter datetime:
// midnight site-local, ISO with LA offset (2020-02-09T00:00:00-08:00).
export function laIso(date: Date): string {
  const { year, month, day, offset } = laParts(date);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}T00:00:00${offset}`;
}

// Liquid's date_to_string: "09 Feb 2020"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateString(date: Date): string {
  const { year, month, day } = laParts(date);
  return `${String(day).padStart(2, '0')} ${MONTHS[month]} ${year}`;
}

// Liquid "%b %e, %Y" (footer "last updated"): "Sep 28, 2026"
export function formatShortDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}