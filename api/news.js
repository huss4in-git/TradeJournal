// Put this at  api/news.js  in your project root (not in src/).
// Vercel turns it into  https://your-site.vercel.app/api/news
//
// Why a server function rather than fetching from the browser:
//   1. Forex Factory sends no CORS headers, so a browser fetch is blocked.
//   2. They rate-limit to 2 downloads per 5 minutes, then serve an HTML
//      "Request Denied" page instead of JSON. The s-maxage header below makes
//      Vercel's CDN serve a cached copy for 6 hours, so no matter how many
//      times you open the app, the feed is hit at most a few times a day.

const FEEDS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
  ];
  
  export default async function handler(req, res) {
    try {
      const results = await Promise.all(
        FEEDS.map(async (url) => {
          const r = await fetch(url, {
            headers: { "User-Agent": "tradelog/1.0" },
          });
          if (!r.ok) return [];
          const text = await r.text();
          // Rate-limited responses come back as an HTML page, not JSON.
          if (!text.trim().startsWith("[")) return [];
          try {
            return JSON.parse(text);
          } catch {
            return [];
          }
        })
      );
  
      const events = results
        .flat()
        .filter((e) => e && e.date && e.title)
        .map((e) => ({
          // e.date is ISO with an offset, e.g. "2026-08-03T18:00:00-04:00".
          date: e.date,
          title: e.title,
          currency: e.country,
          impact: e.impact, // "High" | "Medium" | "Low" | "Holiday"
          forecast: e.forecast || "",
          previous: e.previous || "",
        }));
  
      // Fresh for 6 hours, and the CDN may serve a stale copy for another day
      // while it refreshes in the background — so a rate-limit blip is invisible.
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=21600, stale-while-revalidate=86400"
      );
      res.status(200).json({ events });
    } catch (err) {
      res.status(200).json({ events: [], error: String(err) });
    }
  }