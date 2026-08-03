import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ReferenceLine,
} from "recharts";
import {
  Bell,
  User,
  Plus,
  Pencil,
  Trash2,
  X,
  LayoutGrid,
  CandlestickChart,
  NotebookPen,
  BarChart3,
  ClipboardList,
  TrendingUp,
  Wallet,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ------------------------------------------------------------------
   Theme
   bg #0A0A0B · surface #121316 · raised #17181B · border #232529
   text #FFFFFF · muted #8A8D94 · dim #6E7076
   green #4ADE80 · red #F87171 · flat #60A5FA
   ------------------------------------------------------------------ */
const GREEN = "#4ADE80";
const RED = "#F87171";
const FLAT = "#60A5FA";

// Starting equity used to draw the balance line. Set this to your account size.
const STARTING_BALANCE = 1000;

// Exact dollars and cents everywhere, e.g. $105.23
const currency = (n) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const compact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

// Three significant digits, so the string never exceeds ~6 characters and
// still fits a narrow calendar cell on a phone. $347, -$19.4, -$96.3, $1.2k
const tight = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  if (abs >= 10) return `${sign}$${abs.toFixed(1)}`;
  return `${sign}$${abs.toFixed(2)}`;
};

// One decimal place in the calendar, where two decimals are more precision
// than the eye needs when scanning a month. A trailing .0 is dropped, so
// whole amounts read as $150 rather than $150.0.
const oneDp = (n) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Shown in the symbol dropdown before you've logged anything. Anything you
// type that isn't here gets added to the list automatically once saved.
const DEFAULT_SYMBOLS = [
  "XAUUSD",
  "NAS100",
  "SP500",
  "EURUSD",
  "GBPUSD",
  "WTI",
  "BTCUSD",
];

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function toDateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ------------------------------------------------------------------
   Derived calculations — all computed from real entries.
   ------------------------------------------------------------------ */
function groupByDay(trades) {
  const byDay = {};
  trades.forEach((t) => {
    if (!byDay[t.date]) byDay[t.date] = { pnl: 0, count: 0, wins: 0, notes: 0 };
    byDay[t.date].pnl += t.pnl;
    byDay[t.date].count += 1;
    if (t.pnl > 0) byDay[t.date].wins += 1;
    if (t.note) byDay[t.date].notes += 1;
  });
  return byDay;
}

function computeStats(trades) {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const flats = trades.filter((t) => t.pnl === 0);

  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossPnl = trades.reduce((s, t) => s + (t.gross ?? t.pnl), 0);
  const totalFees = trades.reduce((s, t) => s + (t.fees ?? 0), 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const ratio = avgLoss ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  const byDay = groupByDay(trades);
  const dayValues = Object.values(byDay).map((d) => d.pnl);
  const winDays = dayValues.filter((d) => d > 0).length;
  const lossDays = dayValues.filter((d) => d < 0).length;
  const flatDays = dayValues.filter((d) => d === 0).length;
  const dayWinRate = dayValues.length ? (winDays / dayValues.length) * 100 : 0;

  const meanDay = dayValues.length ? dayValues.reduce((s, d) => s + d, 0) / dayValues.length : 0;
  const meanAbs = dayValues.length
    ? dayValues.reduce((s, d) => s + Math.abs(d), 0) / dayValues.length
    : 0;
  const variance = dayValues.length
    ? dayValues.reduce((s, d) => s + (d - meanDay) ** 2, 0) / dayValues.length
    : 0;
  const cv = meanAbs > 0 ? Math.sqrt(variance) / meanAbs : 2;
  const consistency = clamp(100 * (1 - cv / 2));

  const parts = {
    "Win %": clamp((winRate / 60) * 100),
    "Profit factor": clamp(((Number.isFinite(profitFactor) ? profitFactor : 3) / 2.5) * 100),
    "Avg win/loss": clamp(((Number.isFinite(ratio) ? ratio : 3) / 2.5) * 100),
    "Day win %": clamp((dayWinRate / 60) * 100),
    Consistency: consistency,
  };
  const score = Object.values(parts).reduce((s, v) => s + v, 0) / Object.keys(parts).length;

  return {
    netPnl,
    grossPnl,
    totalFees,
    grossWin,
    grossLoss,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    ratio,
    dayWinRate,
    tradingDays: dayValues.length,
    counts: { wins: wins.length, losses: losses.length, flats: flats.length },
    dayCounts: { wins: winDays, losses: lossDays, flats: flatDays },
    consistency,
    parts,
    score,
    balance: STARTING_BALANCE + netPnl,
  };
}

function buildDailySeries(trades) {
  const byDay = groupByDay(trades);
  const sorted = Object.entries(byDay).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  let running = 0;
  return sorted.map(([date, info]) => {
    running += info.pnl;
    return {
      key: date,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      daily: info.pnl,
      cumulative: running,
      balance: STARTING_BALANCE + running,
    };
  });
}

/* ------------------------------------------------------------------ */

export default function TradingJournalDashboard({ session }) {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  // Your last chosen range survives a reload. Stored per browser, so your
  // brother's phone keeps its own.
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem("tradelog:range") || "{}");
    } catch {
      return {};
    }
  })();

  const [range, setRange] = useState(saved.range || "month");
  const [symbolFilter, setSymbolFilter] = useState(saved.symbolFilter || "all");
  const [customFrom, setCustomFrom] = useState(saved.customFrom || "");
  const [customTo, setCustomTo] = useState(saved.customTo || "");

  useEffect(() => {
    try {
      localStorage.setItem(
        "tradelog:range",
        JSON.stringify({ range, symbolFilter, customFrom, customTo })
      );
    } catch {
      // Private browsing can throw on write; the app works fine without it.
    }
  }, [range, symbolFilter, customFrom, customTo]);
  const [showFilters, setShowFilters] = useState(false);

  // Sticky offsets are driven by the real top bar height, published as a
  // CSS variable. Hardcoding it causes a few pixels of jump on scroll.
  const topBarRef = useRef(null);
  const headRowRef = useRef(null);
  useLayoutEffect(() => {
    const bar = topBarRef.current;
    const row = headRowRef.current;
    if (!bar) return;
    const publish = () => {
      const root = document.documentElement.style;
      root.setProperty("--topbar-h", `${bar.offsetHeight}px`);
      root.setProperty("--headrow-h", `${row ? row.offsetHeight : 0}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(bar);
    if (row) ro.observe(row);
    return () => ro.disconnect();
  }, []);

  // Hide on scroll down, show on scroll up. State only flips when the
  // direction changes, so this re-renders twice per scroll rather than
  // on every frame.
  const [navVisible, setNavVisible] = useState(true);
  useEffect(() => {
    let lastScroll = 0;

    const handleScroll = () => {
      const currentScroll = window.scrollY;

      // iOS rubber-banding reports scroll positions above the document
      // height and below zero. Those bounce back and forth, which would
      // flip the nav repeatedly and re-render the whole dashboard.
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (currentScroll < 0 || currentScroll > maxScroll) return;


      // Ignore small jitter so the nav only reacts to real direction changes.
      const delta = currentScroll - lastScroll;
      if (Math.abs(delta) < 8) return;

      const isDesktop = window.innerWidth >= 640;
      setNavVisible(isDesktop || !(delta > 0 && currentScroll > 100));
      lastScroll = currentScroll;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("manual_entries")
        .select("*")
        .order("entry_date", { ascending: true });

      if (error) {
        console.error("Failed to load entries:", error.message);
      } else if (data) {
        setTrades(
          data.map((row) => {
            const gross = Number(row.pnl);
            const commission = Number(row.commission ?? 0);
            const swap = Number(row.swap ?? 0);
            return {
              id: row.id,
              date: row.entry_date,
              symbol: row.symbol,
              gross,
              commission,
              swap,
              fees: commission + swap,
              // net_pnl is generated in Postgres; fall back for pre-migration rows
              pnl: row.net_pnl != null ? Number(row.net_pnl) : gross + commission + swap,
              note: row.note,
            };
          })
        );
      }
      setLoaded(true);
    })();
  }, []);

  // High-impact economic events, grouped by local date. Served from
  // /api/news, which proxies and caches the Forex Factory feed.
  const [newsByDay, setNewsByDay] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/news");
        const { events = [] } = await res.json();
        const byDay = {};
        events.forEach((e) => {
          // Gold, indices and oil all price off the dollar, so only USD
          // releases matter here. "All" covers things like OPEC meetings.
          if (e.currency !== "USD" && e.currency !== "All") return;
          const d = new Date(e.date);
          if (Number.isNaN(d.getTime())) return;
          const key = toDateKey(d); // local date, matching the calendar
          (byDay[key] ||= []).push({ ...e, time: d });
        });
        Object.values(byDay).forEach((list) => list.sort((a, b) => a.time - b.time));
        setNewsByDay(byDay);
      } catch {
        // No news is fine — the calendar just shows no dots.
      }
    })();
  }, []);

  const symbols = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol).filter(Boolean))).sort(),
    [trades]
  );

  // Your own symbols first, then the seed list — so what you actually
  // trade sits at the top of the dropdown.
  const symbolOptions = useMemo(
    () => Array.from(new Set([...symbols, ...DEFAULT_SYMBOLS])),
    [symbols]
  );

  const visible = useMemo(() => {
    const now = new Date();
    let from = null;
    let to = null;

    if (range === "30d") from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    if (range === "90d") from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
    if (range === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    if (range === "custom") {
      // Compare on the date key so timezones can't shift the boundary.
      from = customFrom || null;
      to = customTo || null;
    }

    return trades.filter((t) => {
      if (symbolFilter !== "all" && t.symbol !== symbolFilter) return false;

      if (range === "custom") {
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return true;
      }

      if (!from) return true;
      return new Date(t.date) >= from;
    });
  }, [trades, range, symbolFilter, customFrom, customTo]);

  const stats = useMemo(() => computeStats(visible), [visible]);
  const series = useMemo(() => buildDailySeries(visible), [visible]);

  // Where the starting balance sits inside the chart's value range, as a
  // 0–100% offset. The fill flips from green to red at that point.
  const splitAt = useMemo(() => {
    if (!series.length) return "100%";
    const vals = series.map((d) => d.balance);
    const hi = Math.max(...vals, STARTING_BALANCE);
    const lo = Math.min(...vals, STARTING_BALANCE);
    if (hi === lo) return "100%";
    return `${clamp(((hi - STARTING_BALANCE) / (hi - lo)) * 100)}%`;
  }, [series]);
  // The calendar has its own month navigation, so it ignores the date range —
  // otherwise stepping back a month would show an empty grid. Symbol filter
  // still applies.
  const calendarTrades = useMemo(
    () => trades.filter((t) => symbolFilter === "all" || t.symbol === symbolFilter),
    [trades, symbolFilter]
  );
  const calendar = useMemo(() => groupByDay(calendarTrades), [calendarTrades]);
  const hasData = visible.length > 0;

  // Whichever range is applied, the calendar opens on the month that
  // range starts in.
  const focusMonth = useMemo(() => {
    const now = new Date();
    if (range === "custom") return customFrom || null;
    if (range === "month") return toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    if (range === "30d")
      return toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    if (range === "90d")
      return toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
    // All time: the earliest entry you have, or this month if there are none.
    if (!trades.length) return toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    return [...trades].sort((a, b) => (a.date < b.date ? -1 : 1))[0].date;
  }, [range, customFrom, trades]);

  const rangeLabel = {
    month: "This month",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    all: "All time",
    custom: "Custom",
  }[range];

  const lastEntry = useMemo(() => {
    if (!trades.length) return null;
    return [...trades].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;
  }, [trades]);

  // Handles both new entries and edits. `entry.id` present means update.
  async function saveEntry(entry) {
    const payload = {
      entry_date: entry.date,
      symbol: entry.symbol || null,
      pnl: entry.gross,
      commission: entry.commission,
      swap: entry.swap,
      note: entry.note || null,
    };

    const query = entry.id
      ? supabase.from("manual_entries").update(payload).eq("id", entry.id)
      : supabase.from("manual_entries").insert(payload);

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Failed to save entry:", error.message);
      return;
    }

    const gross = Number(data.pnl);
    const commission = Number(data.commission ?? 0);
    const swap = Number(data.swap ?? 0);
    const row = {
      id: data.id,
      date: data.entry_date,
      symbol: data.symbol,
      gross,
      commission,
      swap,
      fees: commission + swap,
      pnl: data.net_pnl != null ? Number(data.net_pnl) : gross + commission + swap,
      note: data.note,
    };

    setTrades((prev) =>
      entry.id ? prev.map((t) => (t.id === row.id ? row : t)) : [...prev, row]
    );
    setEditing(null);
    setShowForm(false);
  }

  async function deleteEntry(id) {
    const { error } = await supabase.from("manual_entries").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete entry:", error.message);
      return;
    }
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans">
      {/* Top bar and the mobile Dashboard row sit in one sticky container.
          The bar lives in a shell whose height animates to zero; the bar is
          anchored to the shell's bottom, so it slides up out of view rather
          than being squashed. The Dashboard row is plain flow underneath, so
          it rises with the shell and no gap can open between them.
          (Animating `top` on a sticky element instead is what caused the gap:
          Safari snaps it rather than transitioning it.) */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <div
          style={{ height: navVisible ? "var(--topbar-h, 64px)" : "0px" }}
          className="relative overflow-hidden transition-[height] duration-500"
        >
          <div
            ref={topBarRef}
            className="absolute inset-x-0 bottom-0 bg-[#0D0E10] border-b border-[#1D1F23] px-4 sm:px-6 py-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Logo />
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-lg bg-[#17181B] border border-[#232529] flex items-center justify-center cursor-default hover:border-[#2E3137] transition-colors">
                <Bell size={15} className="text-[#8A8D94]" />
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                title={session?.user?.email ? `Sign out ${session.user.email}` : "Sign out"}
                aria-label="Sign out"
                className="w-9 h-9 rounded-lg bg-[#17181B] border border-[#232529] flex items-center justify-center cursor-pointer hover:border-[#F87171]/40 hover:text-[#F87171] text-[#8A8D94] transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile header */}
        <div
          ref={headRowRef}
          className="sm:hidden bg-[#0A0A0B] border-b border-[#1D1F23] px-4 pt-4 pb-4 flex items-center justify-between gap-3"
        >
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label="Date range"
            className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
              showFilters
                ? "bg-[#4ADE80]/10 border-[#4ADE80]/25 text-[#4ADE80]"
                : "bg-[#17181B] border-[#232529] text-[#C9CBD1]"
            }`}
          >
            <CalendarDays size={14} />
            {rangeLabel}
          </button>
        </div>
      </div>

      {/* Reserves the header's full height. Constant, so collapsing the bar
          moves only the header — the page below never shifts. */}
      <div style={{ height: "calc(var(--topbar-h, 64px) + var(--headrow-h, 0px))" }} />

      <div className="flex">
        {/* Icon rail */}
        <nav className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-1.5 py-5 bg-[#0D0E10] border-r border-[#1D1F23] sticky top-[var(--topbar-h,64px)] h-[calc(100vh-var(--topbar-h,64px))] self-start">
          <RailButton icon={LayoutGrid} active />
          <RailButton icon={CandlestickChart} />
          <RailButton icon={NotebookPen} />
          <RailButton icon={BarChart3} />
          <RailButton icon={ClipboardList} />
          <div className="h-px w-7 bg-[#1D1F23] my-2" />
          <RailButton icon={TrendingUp} />
          <RailButton icon={Wallet} />
        </nav>

        <main className="flex-1 min-w-0 px-4 sm:px-5 pt-0 pb-6 sm:py-6">
          {/* Header row */}
          <div className="hidden sm:flex items-center justify-between mb-1 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#6E7076] mt-0.5">
                Performance metrics and trading history
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex h-9 items-center gap-2 px-3.5 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/25 text-xs font-medium text-[#4ADE80]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                Manual entries
              </span>
              <Select value={symbolFilter} onChange={setSymbolFilter} label="Symbol">
                <option value="all">All symbols</option>
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <button
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  showFilters
                    ? "bg-[#4ADE80]/10 border-[#4ADE80]/25 text-[#4ADE80]"
                    : "bg-[#17181B] border-[#232529] text-[#C9CBD1] hover:border-[#2E3137]"
                }`}
              >
                <CalendarDays size={14} />
                {rangeLabel}
              </button>
            </div>
          </div>

          {showFilters && (
            <DateRangeSheet
              range={range}
              from={customFrom}
              to={customTo}
              onApply={(r, f, t) => {
                setRange(r);
                setCustomFrom(f);
                setCustomTo(t);
                setShowFilters(false);
              }}
              onClose={() => setShowFilters(false)}
            />
          )}

          <div className="hidden sm:block h-px bg-[#1D1F23] my-4" />

          {/* Meta row */}
          <div className="flex items-center justify-between gap-3 flex-wrap mt-3 sm:mt-0 mb-4">
            <p className="text-xs text-[#6E7076]">
              {lastEntry ? (
                <>
                  Last entry{" "}
                  <span className="text-[#C9CBD1] font-medium">
                    {new Date(lastEntry).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="mx-2 text-[#33363B]">·</span>
                  {visible.length} of {trades.length} shown
                </>
              ) : loaded ? (
                "Nothing logged yet"
              ) : (
                "Loading entries…"
              )}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#4ADE80] text-[#08130C] text-sm font-semibold cursor-pointer hover:bg-[#3ECF74] transition-colors"
            >
              <Plus size={15} />
              Add Entry
            </button>
          </div>

          {/* KPI row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <Card>
              <div className="flex items-center justify-between">
                <Label>Net P&L</Label>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#17181B] border border-[#232529] text-[#8A8D94]">
                  {visible.length}
                </span>
              </div>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  !hasData ? "text-[#4A4D53]" : stats.netPnl >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"
                }`}
              >
                {hasData ? `${stats.netPnl >= 0 ? "+" : "-"}${currency(Math.abs(stats.netPnl))}` : "--"}
              </p>
              <p className="mt-1.5 text-[11px] text-[#6E7076]">
                {hasData ? (
                  <>
                    {currency(stats.grossPnl)} gross
                    <span className="mx-1.5 text-[#33363B]">·</span>
                    <span className={stats.totalFees < 0 ? "text-[#F87171]" : undefined}>
                      {currency(stats.totalFees)} fees
                    </span>
                  </>
                ) : (
                  "Add an entry to start tracking"
                )}
              </p>
            </Card>

            <Card>
              <Label>Trade win %</Label>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-2xl font-semibold">{hasData ? `${stats.winRate.toFixed(2)}%` : "--"}</p>
                <Gauge counts={stats.counts} show={hasData} noun="trades" />
              </div>
            </Card>

            <Card>
              <Label>Profit factor</Label>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold">
                    {hasData
                      ? Number.isFinite(stats.profitFactor)
                        ? stats.profitFactor.toFixed(2)
                        : "∞"
                      : "--"}
                  </p>
                  <p className="mt-2 text-[11px] text-[#6E7076]">
                    {hasData
                      ? stats.profitFactor >= 1
                        ? "Above breakeven"
                        : "Below breakeven"
                      : "No trades in range"}
                  </p>
                </div>
                <Donut win={stats.grossWin} loss={stats.grossLoss} show={hasData} />
              </div>
            </Card>
          </div>

          {/* KPI row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <Card>
              <Label>Day win %</Label>
              <div className="flex items-center justify-between gap-4">
                <p className="text-2xl font-semibold mb-1">
                  {hasData ? `${stats.dayWinRate.toFixed(2)}%` : "--"}
                </p>
                <Gauge counts={stats.dayCounts} show={hasData} noun="days" />
              </div>
            </Card>

            <Card>
              <Label>Avg win/loss trade</Label>
              <div className="mt-5 flex items-center gap-5">
                <p className="text-2xl font-semibold shrink-0">
                  {hasData ? (Number.isFinite(stats.ratio) ? stats.ratio.toFixed(2) : "∞") : "--"}
                </p>
                <SplitBar avgWin={stats.avgWin} avgLoss={stats.avgLoss} show={hasData} />
              </div>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <Card title="Trade score">
              <ScoreRadar parts={stats.parts} score={stats.score} show={hasData} />
            </Card>

            <Card title="Daily net cumulative P&L">
              {hasData ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={series} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1D1F23" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#1D1F23"
                      tick={{ fontSize: 11, fill: "#6E7076" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6E7076" }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={compact}
                    />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} labelStyle={labelStyle} formatter={(v) => [currency(v), "Cumulative"]} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke={GREEN}
                      strokeWidth={2}
                      fill="url(#cumFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No entries yet" hint="Your equity curve is built from logged days" />
              )}
            </Card>

            <Card title="Net daily P&L">
              {hasData ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={series} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#1D1F23" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#1D1F23"
                      tick={{ fontSize: 11, fill: "#6E7076" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6E7076" }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={compact}
                    />
                    <Tooltip
                      cursor={{ fill: "#17181B" }}
                      contentStyle={tooltipStyle}
                      itemStyle={itemStyle}
                      labelStyle={labelStyle}
                      formatter={(v) => [currency(v), "Day"]}
                    />
                    <Bar dataKey="daily" radius={[3, 3, 0, 0]} maxBarSize={14}>
                      {series.map((d) => (
                        <Cell key={d.key} fill={d.daily >= 0 ? GREEN : RED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No entries yet" hint="Each bar is one logged trading day" />
              )}
            </Card>
          </div>

          {/* Lower section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
            <div className="space-y-3">
              <TradesPanel trades={visible} onDelete={deleteEntry} onEdit={setEditing} />

              <div className="hidden xl:block">
              <Card title="Account balance">
                {hasData ? (
                  <>
                    <div className="flex items-center gap-4 mb-2 flex-wrap">
                      <LegendDot color={GREEN}>Above start</LegendDot>
                      <LegendDot color={RED}>Below start</LegendDot>
                    </div>
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={series} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
                        <defs>
                          {/* Both gradients flip colour exactly where the balance
                              crosses your starting capital — green above, red below. */}
                          <linearGradient id="balSplit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={splitAt} stopColor={GREEN} stopOpacity={0.3} />
                            <stop offset={splitAt} stopColor={RED} stopOpacity={0.3} />
                          </linearGradient>
                          <linearGradient id="balStroke" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={splitAt} stopColor={GREEN} />
                            <stop offset={splitAt} stopColor={RED} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1D1F23" vertical={false} />
                        <XAxis
                          dataKey="label"
                          stroke="#1D1F23"
                          tick={{ fontSize: 11, fill: "#6E7076" }}
                          tickLine={false}
                          interval="preserveStartEnd"
                          minTickGap={30}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#6E7076" }}
                          axisLine={false}
                          tickLine={false}
                          width={58}
                          tickFormatter={compact}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={itemStyle}
                          labelStyle={labelStyle}
                          formatter={(v) => [currency(v), "Balance"]}
                        />
                        <ReferenceLine y={STARTING_BALANCE} stroke="#4A4D53" strokeDasharray="4 4" />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke="url(#balStroke)"
                          strokeWidth={2}
                          fill="url(#balSplit)"
                          baseValue={STARTING_BALANCE}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    <div className="mt-3 pt-3 border-t border-[#1D1F23] flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        {currency(stats.balance)}{" "}
                        <span className="text-[#6E7076] font-normal">balance</span>
                      </span>
                      <span
                        className={`font-semibold ${
                          stats.netPnl >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"
                        }`}
                      >
                        {stats.netPnl >= 0 ? "+" : "-"}
                        {currency(Math.abs(stats.netPnl))}{" "}
                        <span className="text-[#6E7076] font-normal">net P&L</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <EmptyState text="No balance history" hint="Balance is starting equity plus logged P&L" />
                )}
              </Card>
              </div>
            </div>

            <div className="xl:col-span-2 order-first xl:order-none">
              <Card noPad>
                <MonthCalendar
                  calendar={calendar}
                  trades={calendarTrades}
                  newsByDay={newsByDay}
                  hasData={calendarTrades.length > 0}
                  focusMonth={focusMonth}
                />
              </Card>
            </div>
          </div>
        </main>
      </div>

      {(showForm || editing) && (
        <EntryModal
          entry={editing}
          symbolOptions={symbolOptions}
          onSave={saveEntry}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "#17181B",
  border: "1px solid #2A2C31",
  borderRadius: 10,
  fontSize: 12,
};
const itemStyle = { color: "#FFFFFF" };
const labelStyle = { color: "#6E7076", fontSize: 11 };

/* ------------------------------------------------------------------
   Recent trades / All entries
   ------------------------------------------------------------------ */
function TradesPanel({ trades, onDelete, onEdit }) {
  const [tab, setTab] = useState("recent");

  const sorted = useMemo(
    () => [...trades].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [trades]
  );
  const rows = tab === "recent" ? sorted.slice(0, 6) : sorted;

  return (
    <div className="bg-[#121316] rounded-2xl border border-[#232529] overflow-hidden">
      <div className="flex items-center gap-6 px-5 pt-4 border-b border-[#1D1F23]">
        <Tab active={tab === "recent"} onClick={() => setTab("recent")}>
          Recent trades
        </Tab>
        <Tab active={tab === "all"} onClick={() => setTab("all")}>
          All entries
        </Tab>
      </div>

      {rows.length ? (
        <div className={tab === "all" ? "max-h-[420px] overflow-y-auto" : ""}>
          <table className="w-full text-sm">
            <thead className="bg-[#17181B] sticky top-0">
              <tr className="text-[11px] uppercase tracking-wider text-[#6E7076]">
                <th className="py-3 px-5 text-left font-medium">Close date</th>
                <th className="py-3 px-4 text-left font-medium">Symbol</th>
                <th className="py-3 px-5 text-right font-medium">Net P&L</th>
                <th className="py-3 pr-4 w-14" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[#1D1F23] last:border-0 hover:bg-[#17181B]/60 group"
                >
                  <td className="py-3.5 px-5 text-[#8A8D94]">
                    {new Date(t.date).toLocaleDateString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-[#E4E6EA]">
                    <span>{t.symbol || "—"}</span>
                    {t.note && (
                      <span
                        title={t.note}
                        className="block text-[11px] text-[#6E7076] truncate max-w-[150px]"
                      >
                        {t.note}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-3.5 px-5 text-right font-semibold ${
                      t.pnl >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"
                    }`}
                    title={
                      t.fees
                        ? `Gross ${currency(t.gross)} · commission ${currency(
                            t.commission
                          )} · swap ${currency(t.swap)}`
                        : undefined
                    }
                  >
                    {t.pnl < 0 ? "-" : ""}
                    {currency(Math.abs(t.pnl))}
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2.5 justify-end">
                      <button
                        onClick={() => onEdit(t)}
                        aria-label="Edit entry"
                        className="text-[#4A4D53] opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 cursor-pointer hover:text-[#4ADE80] transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(t.id)}
                        aria-label="Delete entry"
                        className="text-[#4A4D53] opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 cursor-pointer hover:text-[#F87171] transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState text="No trades in this range" hint="Add an entry or widen the date range" />
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-[15px] font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
        active ? "text-[#4ADE80] border-[#4ADE80]" : "text-[#6E7076] border-transparent hover:text-[#C9CBD1]"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------
   Month calendar
   ------------------------------------------------------------------ */
function MonthCalendar({ calendar, trades = [], hasData, focusMonth, newsByDay = {} }) {
  const [openDay, setOpenDay] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const dates = Object.keys(calendar).map((d) => new Date(d));
    const latest = dates.length ? dates.sort((a, b) => b - a)[0] : new Date();
    return new Date(latest.getFullYear(), latest.getMonth(), 1);
  });

  // Applying a custom range moves the calendar to that month, so the
  // dates you just picked are the ones on screen.
  useEffect(() => {
    if (!focusMonth) return;
    const [y, m] = focusMonth.split("-").map(Number);
    setCursor(new Date(y, m - 1, 1));
  }, [focusMonth]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weeks = chunkIntoWeeks(cells);

  let monthTotal = 0;
  let tradingDays = 0;
  Object.entries(calendar).forEach(([dateStr, info]) => {
    const dt = new Date(dateStr);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      monthTotal += info.pnl;
      tradingDays += 1;
    }
  });

  const now = new Date();
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();
  const todayKey = toDateKey(now);

  const weekTotals = (week) => {
    const pnl = week.reduce((sum, d) => {
      if (d === null) return sum;
      const info = calendar[toDateKey(new Date(year, month, d))];
      return sum + (info ? info.pnl : 0);
    }, 0);
    const days = week.filter((d) => d !== null && calendar[toDateKey(new Date(year, month, d))]).length;
    return { pnl, days };
  };

  return (
    <div className="p-2.5 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1">
          <IconArrow onClick={() => setCursor(new Date(year, month - 1, 1))} label="Previous month">
            <ChevronLeft size={17} />
          </IconArrow>
          <span className="text-lg font-semibold w-40 text-center">
            {firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <IconArrow onClick={() => setCursor(new Date(year, month + 1, 1))} label="Next month">
            <ChevronRight size={17} />
          </IconArrow>
        </div>
        <button
          onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}
          className={`h-9 px-4 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
            isThisMonth
              ? "bg-[#4ADE80]/10 border-[#4ADE80]/30 text-[#4ADE80]"
              : "bg-[#17181B] border-[#232529] text-[#C9CBD1] hover:border-[#2E3137]"
          }`}
        >
          This month
        </button>
      </div>

      {/* Monthly stats */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-[#6E7076]">Monthly stats</span>
        <span
          className={`text-sm font-semibold px-2.5 py-1 rounded-md border ${
            !hasData
              ? "bg-[#17181B] border-[#232529] text-[#4A4D53]"
              : monthTotal >= 0
              ? "bg-[#4ADE80]/10 border-[#4ADE80]/25 text-[#4ADE80]"
              : "bg-[#F87171]/10 border-[#F87171]/25 text-[#F87171]"
          }`}
        >
          {hasData ? `${monthTotal >= 0 ? "" : "-"}${currency(Math.abs(monthTotal))}` : "--"}
        </span>
        <span className="text-sm font-medium px-2.5 py-1 rounded-md bg-[#17181B] border border-[#232529] text-[#C9CBD1]">
          {tradingDays} day{tradingDays === 1 ? "" : "s"}
        </span>
      </div>

      {/* Weekday header */}
      <div className="flex gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 flex-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="rounded-lg border border-[#1D1F23] bg-[#0F1012] py-2 text-center text-xs font-medium text-[#6E7076]"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="hidden md:block w-[112px] shrink-0" />
      </div>

      {/* Weeks */}
      <div className="space-y-1 sm:space-y-1.5">
        {weeks.map((week, wi) => {
          const { pnl: weekPnl, days: weekDaysTraded } = weekTotals(week);

          return (
            <div key={wi} className="flex gap-1 sm:gap-1.5">
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 flex-1">
                {week.map((d, i) => {
                  if (d === null)
                    return <div key={i} className="min-h-[74px] sm:min-h-[104px] rounded-lg" />;

                  const key = toDateKey(new Date(year, month, d));
                  const info = calendar[key];
                  const traded = !!info;
                  const news = newsByDay[key] || [];
                  const redFolder = news.filter((n) => n.impact === "High");
                  const orangeFolder = news.filter((n) => n.impact === "Medium");
                  const flat = traded && info.pnl === 0;
                  const win = traded && info.pnl > 0;
                  const winRate = traded ? (info.wins / info.count) * 100 : null;

                  const tone = !traded
                    ? "bg-[#0F1012] border-[#1A1C1F]"
                    : flat
                    ? "bg-[#60A5FA]/10 border-[#60A5FA]/25"
                    : win
                    ? "bg-[#4ADE80]/10 border-[#4ADE80]/25"
                    : "bg-[#F87171]/10 border-[#F87171]/25";

                  return (
                    <div
                      key={i}
                      onClick={() => (traded || news.length) && setOpenDay(key)}
                      role={traded || news.length ? "button" : undefined}
                      tabIndex={traded || news.length ? 0 : undefined}
                      onKeyDown={(e) => {
                        if ((traded || news.length) && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          setOpenDay(key);
                        }
                      }}
                      className={`relative min-h-[74px] sm:min-h-[104px] rounded-lg border p-1.5 sm:p-2 flex flex-col ${tone} ${
                        traded || news.length ? "cursor-pointer hover:brightness-125 transition" : ""
                      } ${key === todayKey ? "ring-1 ring-[#4ADE80]/60" : ""}`}
                    >
                      <span
                        className={`text-[11px] sm:text-xs self-end ${
                          traded ? "text-[#C9CBD1]" : "text-[#4A4D53]"
                        }`}
                      >
                        {d}
                      </span>

                      {traded && (
                        <div className="mt-auto text-right leading-tight min-w-0">
                          <p
                            className={`text-[10px] sm:text-[15px] font-bold ${
                              flat ? "text-[#C9CBD1]" : win ? "text-[#4ADE80]" : "text-[#F87171]"
                            }`}
                            title={`${info.pnl < 0 ? "-" : ""}${currency(Math.abs(info.pnl))}`}
                          >
                            <span className="sm:hidden">{tight(info.pnl)}</span>
                            <span className="hidden sm:inline whitespace-nowrap">
                              {info.pnl < 0 ? "-" : ""}
                              {oneDp(Math.abs(info.pnl))}
                            </span>
                          </p>
                          <p className="text-[9px] sm:text-[11px] text-[#8A8D94] truncate">
                            {info.count}
                            <span className="hidden sm:inline"> trade{info.count > 1 ? "s" : ""}</span>
                          </p>
                          <p className="text-[9px] sm:text-[11px] text-[#6E7076] truncate hidden sm:block">
                            {winRate.toFixed(2)}%
                          </p>
                        </div>
                      )}

                      {traded && info.notes > 0 && (
                        <span
                          title={`${info.notes} note${info.notes > 1 ? "s" : ""}`}
                          className="absolute bottom-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#4ADE80]"
                        />
                      )}

                      {/* Economic releases: red folder for high impact, amber
                          for medium. A bare dot on mobile where there's no room
                          for a count, a labelled badge from sm up. */}
                      {(redFolder.length > 0 || orangeFolder.length > 0) && (
                        <span
                          title={[...redFolder, ...orangeFolder]
                            .map((n) => `${n.currency} ${n.title}`)
                            .join("\n")}
                          className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center rounded-full sm:rounded sm:gap-1 sm:px-1.5 sm:py-0.5 text-[9px] font-semibold leading-none w-1.5 h-1.5 sm:w-auto sm:h-auto ${
                            redFolder.length
                              ? "bg-[#F87171] sm:bg-[#F87171]/20 text-[#F87171]"
                              : "bg-[#E0A32E] sm:bg-[#E0A32E]/20 text-[#E0A32E]"
                          }`}
                        >
                          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-current" />
                          <span className="hidden sm:block">
                            {redFolder.length || orangeFolder.length}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Weekly summary card */}
              <div className="hidden md:flex w-[112px] shrink-0 rounded-xl border border-[#1D1F23] bg-[#0F1012] flex-col items-center justify-center text-center px-2 py-3">
                <p className="text-[11px] text-[#6E7076]">Week {wi + 1}</p>
                <p
                  className={`text-[15px] font-bold mt-0.5 whitespace-nowrap ${
                    weekDaysTraded === 0
                      ? "text-[#4A4D53]"
                      : weekPnl > 0
                      ? "text-[#4ADE80]"
                      : weekPnl < 0
                      ? "text-[#F87171]"
                      : "text-[#C9CBD1]"
                  }`}
                >
                  {weekDaysTraded === 0 ? "$0" : `${weekPnl < 0 ? "-" : ""}${oneDp(Math.abs(weekPnl))}`}
                </p>
                <span className="mt-1.5 text-[11px] text-[#6E7076] bg-[#17181B] border border-[#232529] rounded-full px-2 py-0.5">
                  {weekDaysTraded} day{weekDaysTraded === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly totals on small screens */}
      <div className="md:hidden mt-3 grid grid-cols-2 gap-1.5">
        {weeks.map((week, wi) => {
          const { pnl: weekPnl, days: weekDaysTraded } = weekTotals(week);
          return (
            <div
              key={wi}
              className="rounded-xl border border-[#1D1F23] bg-[#0F1012] px-3 py-2 flex items-center justify-between"
            >
              <span className="text-[11px] text-[#6E7076]">Week {wi + 1}</span>
              <span
                className={`text-sm font-bold whitespace-nowrap ${
                  weekDaysTraded === 0
                    ? "text-[#4A4D53]"
                    : weekPnl > 0
                    ? "text-[#4ADE80]"
                    : weekPnl < 0
                    ? "text-[#F87171]"
                    : "text-[#C9CBD1]"
                }`}
              >
                {weekDaysTraded === 0 ? "$0" : tight(weekPnl)}
              </span>
            </div>
          );
        })}
      </div>

      {openDay && (
        <DayDetailModal
          dateKey={openDay}
          trades={trades.filter((t) => t.date === openDay)}
          news={newsByDay[openDay] || []}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Date range sheet — tap a start day, then an end day. Presets across
   the top for the common cases.
   ------------------------------------------------------------------ */
const PRESETS = [
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "all", label: "All time" },
];

function DateRangeSheet({ range, from, to, onApply, onClose }) {
  const [start, setStart] = useState(range === "custom" ? from : "");
  const [end, setEnd] = useState(range === "custom" ? to : "");
  const [cursor, setCursor] = useState(() => {
    const base = start ? new Date(start) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // First tap sets the start and clears any end. Second tap sets the end,
  // flipping the pair if you picked an earlier day.
  function pick(key) {
    if (!start || end) {
      setStart(key);
      setEnd("");
    } else if (key < start) {
      setEnd(start);
      setStart(key);
    } else {
      setEnd(key);
    }
  }

  const pretty = (k) =>
    k
      ? new Date(k).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#121316] border border-[#232529] rounded-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1D1F23]">
          <h3 className="text-base font-semibold">Date range</h3>
          <button onClick={onClose} aria-label="Close" className="text-[#6E7076] cursor-pointer hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Presets */}
        <div className="flex gap-1.5 px-4 pt-3 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onApply(p.id, "", "")}
              className={`h-8 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                range === p.id
                  ? "bg-[#4ADE80]/10 border-[#4ADE80]/25 text-[#4ADE80]"
                  : "bg-[#17181B] border-[#232529] text-[#C9CBD1]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Selected span */}
        <div className="flex items-center justify-center gap-3 px-4 py-3.5">
          <span className={`text-sm font-medium ${start ? "text-white" : "text-[#4A4D53]"}`}>
            {pretty(start)}
          </span>
          <span className="text-[#4A4D53]">→</span>
          <span className={`text-sm font-medium ${end ? "text-white" : "text-[#4A4D53]"}`}>
            {pretty(end)}
          </span>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-4 pb-2">
          <IconArrow onClick={() => setCursor(new Date(year, month - 1, 1))} label="Previous month">
            <ChevronLeft size={17} />
          </IconArrow>
          <span className="text-sm font-medium">
            {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <IconArrow onClick={() => setCursor(new Date(year, month + 1, 1))} label="Next month">
            <ChevronRight size={17} />
          </IconArrow>
        </div>

        {/* Day grid */}
        <div className="px-3 pb-3">
          <div className="grid grid-cols-7 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
              <div key={w} className="text-center text-[11px] text-[#6E7076] py-1.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="h-10" />;

              const key = toDateKey(new Date(year, month, d));
              const isStart = key === start;
              const isEnd = key === end;
              const inRange = start && end && key > start && key < end;

              return (
                <div
                  key={i}
                  className={`h-10 flex items-center justify-center ${
                    inRange ? "bg-[#4ADE80]/10" : ""
                  } ${isStart && end ? "bg-gradient-to-r from-transparent to-[#4ADE80]/10" : ""} ${
                    isEnd ? "bg-gradient-to-l from-transparent to-[#4ADE80]/10" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => pick(key)}
                    className={`w-9 h-9 rounded-full text-sm cursor-pointer transition-colors ${
                      isStart || isEnd
                        ? "bg-[#4ADE80] text-[#08130C] font-semibold"
                        : inRange
                        ? "text-[#C9CBD1]"
                        : "text-[#C9CBD1] hover:bg-[#232529]"
                    }`}
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-[#1D1F23] sticky bottom-0 bg-[#121316]">
          <button
            onClick={() => {
              setStart("");
              setEnd("");
            }}
            className="flex-1 h-11 rounded-xl border border-[#232529] bg-[#17181B] text-sm font-medium text-[#C9CBD1] cursor-pointer"
          >
            Clear
          </button>
          <button
            disabled={!start || !end}
            onClick={() => onApply("custom", start, end)}
            className="flex-1 h-11 rounded-xl bg-[#4ADE80] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-[#08130C] text-sm font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Day detail — tap a calendar cell to see that day's trades.
   ------------------------------------------------------------------ */
function DayDetailModal({ dateKey, trades, news = [], onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Parse as local time — new Date("2026-07-22") would be UTC and can
  // land on the previous day depending on the timezone.
  const [y, m, d] = dateKey.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);

  const net = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const fees = trades.reduce((s, t) => s + (t.fees ?? 0), 0);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121316] border border-[#232529] rounded-2xl w-full max-w-xs sm:max-w-sm max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-4 pb-3">
          <div>
            <h3 className="text-base font-semibold">
              {dateObj.toLocaleDateString("en-US", { weekday: "long" })}
            </h3>
            <p className="text-xs text-[#6E7076] mt-0.5">
              {dateObj.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#6E7076] cursor-pointer hover:text-white p-1 -mr-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Day summary */}
        <div
          className={`mx-4 rounded-lg border border-[#232529] flex divide-x divide-[#232529] ${
            trades.length ? "" : "hidden"
          }`}
        >
          <div className="flex-1 py-3 text-center">
            <p className="text-[9px] uppercase tracking-wider text-[#6E7076]">Net P&L</p>
            <p
              className={`text-lg font-bold mt-0.5 ${
                net > 0 ? "text-[#4ADE80]" : net < 0 ? "text-[#F87171]" : "text-[#C9CBD1]"
              }`}
            >
              {net >= 0 ? "+" : "-"}
              {currency(Math.abs(net))}
            </p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[9px] uppercase tracking-wider text-[#6E7076]">Win rate</p>
            <p className="text-lg font-bold mt-0.5">{winRate.toFixed(1)}%</p>
          </div>
        </div>

        {fees !== 0 && (
          <p className="px-4 mt-2 text-[10px] text-[#6E7076] text-center">
            Includes <span className="text-[#F87171]">{currency(fees)}</span> in commission and swap
          </p>
        )}

        {/* Per-trade breakdown */}
        <div className={`p-4 pt-4 ${trades.length ? "" : "hidden"}`}>
          <h4 className="text-xs font-semibold mb-2">
            {trades.length} trade{trades.length === 1 ? "" : "s"}
          </h4>

          <table className="w-full">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-[#6E7076] border-b border-[#1D1F23]">
                <th className="text-left font-medium pb-1.5">Symbol</th>
                <th className="text-right font-medium pb-1.5">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-[#1D1F23] last:border-0 align-top">
                  <td className="py-2.5 pr-3">
                    <span className="text-[13px] font-medium text-[#E4E6EA]">{t.symbol || "—"}</span>
                    {t.note && (
                      <span className="block text-[10px] text-[#6E7076] mt-0.5 leading-snug">
                        {t.note}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2.5 text-right text-[13px] font-semibold whitespace-nowrap ${
                      t.pnl > 0
                        ? "text-[#4ADE80]"
                        : t.pnl < 0
                        ? "text-[#F87171]"
                        : "text-[#C9CBD1]"
                    }`}
                  >
                    {t.pnl >= 0 ? "+" : "-"}
                    {currency(Math.abs(t.pnl))}
                    {t.fees !== 0 && (
                      <span className="block text-[9px] text-[#4A4D53] font-normal mt-0.5">
                        {currency(t.gross)} gross
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Economic releases scheduled that day */}
        {news.length > 0 && (
          <div className="px-4 pb-4">
            <h4 className="text-xs font-semibold mb-2">Economic calendar</h4>
            <ul className="space-y-2">
              {news.map((n, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    title={`${n.impact} impact`}
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      n.impact === "High"
                        ? "bg-[#F87171]"
                        : n.impact === "Medium"
                        ? "bg-[#E0A32E]"
                        : "bg-[#4A4D53]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-[#E4E6EA] leading-snug">{n.title}</p>
                    <p className="text-[10px] text-[#6E7076] mt-0.5">
                      {n.currency}
                      <span className="mx-1.5 text-[#33363B]">·</span>
                      {n.time.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {n.forecast && (
                        <>
                          <span className="mx-1.5 text-[#33363B]">·</span>
                          forecast {n.forecast}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function IconArrow({ onClick, children, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E7076] cursor-pointer hover:bg-[#17181B] hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

function chunkIntoWeeks(cells) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null); // pad trailing week so columns stay aligned
    weeks.push(week);
  }
  return weeks;
}

/* ------------------------------------------------------------------
   Shared components
   ------------------------------------------------------------------ */
function RailButton({ icon: Icon, active }) {
  return (
    <button
      className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-default transition-colors ${
        active
          ? "bg-[#4ADE80]/10 border border-[#4ADE80]/25 text-[#4ADE80]"
          : "text-[#5A5D63] hover:bg-[#17181B] hover:text-[#C9CBD1]"
      }`}
    >
      <Icon size={17} />
    </button>
  );
}

function Select({ value, onChange, children, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 pl-3.5 pr-8 rounded-lg bg-[#17181B] border border-[#232529] text-base sm:text-xs font-medium text-[#C9CBD1] cursor-pointer hover:border-[#2E3137] focus:outline-none focus:ring-2 focus:ring-[#4ADE80]/25 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 10 10%22><path d=%22M2 4l3 3 3-3%22 fill=%22none%22 stroke=%22%236E7076%22 stroke-width=%221.4%22/></svg>')] bg-no-repeat bg-[right_0.6rem_center]"
    >
      {children}
    </select>
  );
}

function Card({ title, children, className = "", noPad }) {
  return (
    <div className={`bg-[#121316] rounded-2xl border border-[#232529] ${className}`}>
      {title && (
        <div className="px-5 pt-5 pb-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
      )}
      <div className={noPad ? "" : title ? "p-5 pt-3" : "p-4"}>{children}</div>
    </div>
  );
}

function Label({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-wider text-[#6E7076] font-medium">{children}</p>
  );
}

function LegendDot({ color, children }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[#8A8D94]">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

function EmptyState({ text, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-full bg-[#4ADE80]/8 border border-[#4ADE80]/20 flex items-center justify-center mb-3">
        <Plus size={20} className="text-[#4ADE80]" />
      </div>
      <p className="text-sm text-[#C9CBD1]">{text}</p>
      <p className="text-xs text-[#6E7076] mt-0.5 max-w-[220px]">{hint}</p>
    </div>
  );
}

function Gauge({ counts, show, noun = "trades" }) {
  const r = 26;
  const len = Math.PI * r;
  const total = counts.wins + counts.flats + counts.losses;
  const segs = [
    { v: counts.wins, c: GREEN, label: `winning ${noun}` },
    { v: counts.flats, c: FLAT, label: `breakeven ${noun}` },
    { v: counts.losses, c: RED, label: `losing ${noun}` },
  ];

  let offset = 0;
  return (
    <div className="shrink-0 flex flex-col items-center">
      <svg width="86" height="48" viewBox="0 0 86 48">
        <path
          d="M 17 42 A 26 26 0 0 1 69 42"
          fill="none"
          stroke="#232529"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {show &&
          total > 0 &&
          segs.map((s, i) => {
            const seg = (s.v / total) * len;
            const el =
              s.v > 0 ? (
                <path
                  key={i}
                  d="M 17 42 A 26 26 0 0 1 69 42"
                  fill="none"
                  stroke={s.c}
                  strokeWidth="6"
                  strokeDasharray={`${Math.max(seg - 1.5, 0)} ${len}`}
                  strokeDashoffset={-offset}
                />
              ) : null;
            offset += seg;
            return el;
          })}
      </svg>

      {/* win · breakeven · loss counts, sitting under the arc */}
      <div className=" flex items-center gap-1">
        {segs.map((s, i) => (
          <span
            key={i}
            title={s.label}
            className="text-[11px] leading-none px-2 py-[3px] rounded-md border"
            style={{
              color: show ? s.c : "#4A4D53",
              background: show ? `${s.c}14` : "#17181B",
              borderColor: show ? `${s.c}40` : "#232529",
            }}
          >
            {show ? s.v : "-"}
          </span>
        ))}
      </div>
    </div>
  );
}

function Donut({ win, loss, show }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const total = win + loss;
  const winLen = total ? (win / total) * c : 0;
  return (
    <svg width="65" height="65" viewBox="0 0 60 60" className="shrink-0 -rotate-90">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#232529" strokeWidth="6" />
      {show && total > 0 && (
        <>
          <circle cx="30" cy="30" r={r} fill="none" stroke={RED} strokeWidth="6" />
          <circle
            cx="30"
            cy="30"
            r={r}
            fill="none"
            stroke={GREEN}
            strokeWidth="6"
            strokeDasharray={`${winLen} ${c}`}
          />
        </>
      )}
    </svg>
  );
}

function SplitBar({ avgWin, avgLoss, show }) {
  const total = avgWin + avgLoss;
  const winPct = show && total > 0 ? (avgWin / total) * 100 : 50;
  return (
    <div className="flex-1 min-w-0">
      <div className="h-2 rounded-full bg-[#232529] overflow-hidden flex">
        {show && (
          <>
            <div className="h-full" style={{ width: `${winPct}%`, background: GREEN }} />
            <div className="h-full" style={{ width: `${100 - winPct}%`, background: RED }} />
          </>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs font-medium">
        <span className="text-[#4ADE80]">{show ? currency(avgWin) : "--"}</span>
        <span className="text-[#F87171]">{show ? `-${currency(avgLoss)}` : "--"}</span>
      </div>
    </div>
  );
}

function ScoreRadar({ parts, score, show }) {
  const data = Object.entries(parts).map(([subject, value]) => ({ subject, value: show ? value : 0 }));

  return (
    <div>
      <div className="h-[186px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#232529" gridType="polygon" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6E7076" }} tickLine={false} />
            <Radar
              dataKey="value"
              stroke={GREEN}
              strokeWidth={1.5}
              fill={GREEN}
              fillOpacity={show ? 0.22 : 0}
              dot={show ? { r: 2.5, fill: GREEN, stroke: "none" } : false}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 pt-3 border-t border-[#1D1F23]">
        <div className="flex items-baseline justify-between">
          <Label>Your score</Label>
          <span className="text-lg font-semibold">{show ? score.toFixed(2) : "--"}</span>
        </div>
        <div className="mt-2 relative h-2 rounded-full bg-[#232529]">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#4ADE80]"
            style={{ width: `${show ? clamp(score) : 0}%` }}
          />
          {show && (
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#0A0A0B] border-2 border-[#4ADE80]"
              style={{ left: `${clamp(score)}%` }}
            />
          )}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-[#4A4D53]">
          {[0, 20, 40, 60, 80, 100].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Symbol picker — a dropdown you can also type into. Free text wins,
   so a pair that isn't listed yet just gets typed, and it shows up in
   the list from the next entry onwards.
   ------------------------------------------------------------------ */
function SymbolInput({ value, onChange, options }) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toUpperCase();
    if (!q) return options;
    return options.filter((o) => o.includes(q));
  }, [value, options]);

  const exact = options.some((o) => o === value.trim().toUpperCase());

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a tap on an option registers before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Pick one or type a new pair"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-[#0D0E10] border border-[#232529] rounded-lg pl-3 pr-9 py-2 text-base sm:text-sm text-white placeholder-[#4A4D53] focus:outline-none focus:border-[#4ADE80]/50 focus:ring-2 focus:ring-[#4ADE80]/15"
      />

      <button
        type="button"
        tabIndex={-1}
        aria-label="Show symbols"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="absolute right-0 top-0 h-full px-3 flex items-center text-[#6E7076] cursor-pointer hover:text-[#C9CBD1]"
      >
        <ChevronDown size={15} />
      </button>

      {open && matches.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-lg border border-[#2A2C31] bg-[#17181B] shadow-xl py-1">
          {matches.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-[#232529] transition-colors ${
                  o === value ? "text-[#4ADE80]" : "text-[#C9CBD1]"
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.trim() && !exact && (
        <p className="text-[11px] text-[#4A4D53] mt-1">
          New pair — it'll be in the list next time.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Add entry modal
   ------------------------------------------------------------------ */
function EntryModal({ entry, onSave, onClose, symbolOptions = [] }) {
  const isEdit = !!entry;
  const [date, setDate] = useState(entry?.date ?? toDateKey(new Date()));
  const [symbol, setSymbol] = useState(entry?.symbol ?? "");
  const [gross, setGross] = useState(entry ? String(entry.gross) : "");
  const [commission, setCommission] = useState(
    entry?.commission ? `-${Math.abs(entry.commission)}` : ""
  );
  const [swap, setSwap] = useState(entry?.swap ? `-${Math.abs(entry.swap)}` : "");
  const [note, setNote] = useState(entry?.note ?? "");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  // Digits and a single decimal point only — no letters, no "e", no stray
  // signs. `signed` keeps an optional leading minus for Profit.
  const digits = (v) => {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const [head, ...rest] = cleaned.split(".");
    return rest.length ? `${head}.${rest.join("")}` : head;
  };
  const signed = (v) => (v.trim().startsWith("-") ? `-${digits(v)}` : digits(v));

  // Fees are money leaving the account, so the minus is written in for you
  // and can't be removed.
  const asFee = (v) => {
    const d = digits(v);
    return d === "" ? "" : `-${d}`;
  };
  const fee = (v) => -Math.abs(num(v));

  const grossValid = !Number.isNaN(parseFloat(gross));
  const net = num(gross) + fee(commission) + fee(swap);

  function handleSubmit(e) {
    e.preventDefault();
    if (!grossValid) return;
    onSave({
      id: entry?.id,
      date,
      symbol: symbol.trim().toUpperCase(),
      gross: num(gross),
      commission: fee(commission),
      swap: fee(swap),
      note: note.trim(),
    });
  }

  const field =
    "w-full bg-[#0D0E10] border border-[#232529] rounded-lg px-3 py-2 text-base sm:text-sm text-white placeholder-[#4A4D53] focus:outline-none focus:border-[#4ADE80]/50 focus:ring-2 focus:ring-[#4ADE80]/15 [color-scheme:dark]";
  const labelCls = "text-[11px] uppercase tracking-wider text-[#6E7076] block mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#121316] border border-[#232529] rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{isEdit ? "Edit entry" : "Add entry"}</h3>
          <button onClick={onClose} aria-label="Close" className="text-[#6E7076] cursor-pointer hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required />
          </div>
          <div>
            <label className={labelCls}>
              Symbol <span className="normal-case tracking-normal text-[#4A4D53]">optional</span>
            </label>
            <SymbolInput value={symbol} onChange={setSymbol} options={symbolOptions} />
          </div>

          <div>
            <label className={labelCls}>Profit</label>
            <input
              type="text"
              inputMode="decimal"
              value={gross}
              onChange={(e) => setGross(signed(e.target.value))}
              placeholder="112.40"
              className={field}
              required
            />
            <p className="text-[11px] text-[#4A4D53] mt-1">
              The MT5 Profit column, before fees. Start with a minus for a loss.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Commission</label>
              <input
                type="text"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(asFee(e.target.value))}
                placeholder="-0.70"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Swap</label>
              <input
                type="text"
                inputMode="decimal"
                value={swap}
                onChange={(e) => setSwap(asFee(e.target.value))}
                placeholder="-1.47"
                className={field}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#4A4D53]">
            The minus is added for you — both always come off the total. Leave blank if the
            account charges neither.
          </p>

          {/* Live net so you can check it against the balance change in MT5 */}
          <div className="flex items-center justify-between rounded-lg bg-[#0D0E10] border border-[#232529] px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-[#6E7076]">Net P&L</span>
            <span
              className={`text-sm font-semibold ${
                !grossValid ? "text-[#4A4D53]" : net >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"
              }`}
            >
              {grossValid ? `${net >= 0 ? "+" : "-"}${currency(Math.abs(net))}` : "--"}
            </span>
          </div>

          <div>
            <label className={labelCls}>
              Note <span className="normal-case tracking-normal text-[#4A4D53]">optional</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Setup, mistake, mood..."
              className={field}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#4ADE80] hover:bg-[#3ECF74] text-[#08130C] rounded-lg py-2.5 text-sm font-semibold mt-2 cursor-pointer transition-colors"
          >
            {isEdit ? "Update entry" : "Save entry"}
          </button>
        </form>
      </div>
    </div>
  );
}