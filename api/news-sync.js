// Put this at  api/news-sync.js
//
// Runs on a schedule (see vercel.json). Fetches the Forex Factory feed and
// writes it into Supabase. Forex Factory often refuses requests from
// datacentre IPs — that's fine here, because the database keeps the last
// good copy and one success a day is enough to stay current.

import { createClient } from "@supabase/supabase-js";

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
      if (!text.trim().startsWith("[")) continue; // rate-limited HTML page
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // try the next host
    }
  }
  return [];
}

export default async function handler(req, res) {
  // Vercel cron sends this header; it stops anyone else triggering a sync.
  if (
    process.env.CRON_SECRET &&
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const weeks = await Promise.all(WEEKS.map(fetchWeek));
  const rows = weeks
    .flat()
    .filter((e) => e && e.date && e.title)
    // Only what this journal cares about: dollar-driven instruments.
    .filter((e) => e.country === "USD" || e.country === "All")
    .filter((e) => e.impact === "High" || e.impact === "Medium")
    .map((e) => ({
      event_at: e.date,
      title: e.title,
      currency: e.country,
      impact: e.impact,
      forecast: e.forecast || "",
      previous: e.previous || "",
      updated_at: new Date().toISOString(),
    }));

  if (!rows.length) {
    // Feed refused us. Leave the table alone — stale data beats none.
    return res.status(200).json({ synced: 0, note: "feed unavailable" });
  }

  const { error } = await supabase
    .from("news_events")
    .upsert(rows, { onConflict: "event_at,title,currency" });

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ synced: rows.length });
}