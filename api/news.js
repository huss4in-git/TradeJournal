// Put this at  api/news.js  in your project root (not in src/).
// Vercel serves it at  https://your-site.vercel.app/api/news
//
// Forex Factory sends no CORS headers, so this can't be fetched from the
// browser. They also rate-limit to 2 downloads per 5 minutes and return an
// HTML "Request Denied" page past that — hence the caching below.

// Two hostnames serve the same files. If one refuses, try the other.
const HOSTS = ["https://nfs.faireconomy.media", "https://cdn-nfs.faireconomy.media"];
const WEEKS = ["thisweek", "nextweek"];

async function fetchWeek(week) {
  for (const host of HOSTS) {
    try {
      const r = await fetch(`${host}/ff_calendar_${week}.json`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "application/json",
        },
      });
      if (!r.ok) continue;
      const text = await r.text();
      // A rate-limited response is an HTML page, not a JSON array.
      if (!text.trim().startsWith("[")) continue;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // Try the next host.
    }
  }
  return [];
}

export default async function handler(req, res) {
  let events = [];

  try {
    const weeks = await Promise.all(WEEKS.map(fetchWeek));
    events = weeks
      .flat()
      .filter((e) => e && e.date && e.title)
      .map((e) => ({
        date: e.date, // ISO with offset, e.g. "2026-08-03T18:00:00-04:00"
        title: e.title,
        currency: e.country,
        impact: e.impact, // "High" | "Medium" | "Low" | "Holiday"
        forecast: e.forecast || "",
        previous: e.previous || "",
      }));
  } catch {
    events = [];
  }

  if (events.length) {
    // Good response: cache hard. Fresh for 6 hours, and the CDN may keep
    // serving this copy for a day while it refreshes in the background —
    // so a rate-limit blip never reaches you.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=21600, stale-while-revalidate=86400"
    );
  } else {
    // Empty means the feed refused us. Caching that would blank the calendar
    // for hours, so retry on the next request instead.
    res.setHeader("Cache-Control", "no-store");
  }

  res.status(200).json({ events, count: events.length });
}