import React, { useEffect, useMemo, useState } from "react";
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
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [range, setRange] = useState("month");
  const [symbolFilter, setSymbolFilter] = useState("all");

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

  const symbols = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol).filter(Boolean))).sort(),
    [trades]
  );

  const visible = useMemo(() => {
    const now = new Date();
    let from = null;
    if (range === "30d") from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    if (range === "90d") from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
    if (range === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);

    return trades.filter((t) => {
      if (symbolFilter !== "all" && t.symbol !== symbolFilter) return false;
      if (!from) return true;
      return new Date(t.date) >= from;
    });
  }, [trades, range, symbolFilter]);

  const stats = useMemo(() => computeStats(visible), [visible]);
  const series = useMemo(() => buildDailySeries(visible), [visible]);
  const calendar = useMemo(() => groupByDay(visible), [visible]);
  const hasData = visible.length > 0;

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
      {/* Top bar */}
      <div className="bg-[#0D0E10] border-b border-[#1D1F23] px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="lg:hidden w-9 h-9 rounded-lg bg-[#17181B] border border-[#232529] flex items-center justify-center">
            <Menu size={16} className="text-[#8A8D94]" />
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-lg bg-[#17181B] border border-[#232529] flex items-center justify-center hover:border-[#2E3137] transition-colors">
            <Bell size={15} className="text-[#8A8D94]" />
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            title={session?.user?.email ? `Sign out ${session.user.email}` : "Sign out"}
            aria-label="Sign out"
            className="w-9 h-9 rounded-lg bg-[#17181B] border border-[#232529] flex items-center justify-center hover:border-[#F87171]/40 hover:text-[#F87171] text-[#8A8D94] transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Icon rail */}
        <nav className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-1.5 py-5 bg-[#0D0E10] border-r border-[#1D1F23] min-h-[calc(100vh-61px)]">
          <RailButton icon={LayoutGrid} active />
          <RailButton icon={CandlestickChart} />
          <RailButton icon={NotebookPen} />
          <RailButton icon={BarChart3} />
          <RailButton icon={ClipboardList} />
          <div className="h-px w-7 bg-[#1D1F23] my-2" />
          <RailButton icon={TrendingUp} />
          <RailButton icon={Wallet} />
        </nav>

        <main className="flex-1 min-w-0 px-4 sm:px-5 py-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#6E7076] mt-0.5">Performance metrics and trading history</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={symbolFilter} onChange={setSymbolFilter} label="Symbol">
                <option value="all">All symbols</option>
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select value={range} onChange={setRange} label="Date range">
                <option value="all">All time</option>
                <option value="month">This month</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </Select>
              <span className="h-9 inline-flex items-center gap-2 px-3.5 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/25 text-xs font-medium text-[#4ADE80]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                Manual entries
              </span>
            </div>
          </div>

          <div className="h-px bg-[#1D1F23] my-4" />

          {/* Meta row */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
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
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#4ADE80] text-[#08130C] text-sm font-semibold hover:bg-[#3ECF74] transition-colors"
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
                      <LegendDot color={GREEN}>Balance</LegendDot>
                      <span className="text-xs text-[#6E7076]">
                        Start {currency(STARTING_BALANCE)}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={series} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
                        <defs>
                          <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={GREEN} stopOpacity={0.28} />
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
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={GREEN}
                          strokeWidth={2}
                          fill="url(#balFill)"
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
                <MonthCalendar calendar={calendar} hasData={hasData} />
              </Card>
            </div>
          </div>
        </main>
      </div>

      {(showForm || editing) && (
        <EntryModal
          entry={editing}
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
                        className="text-[#4A4D53] opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hover:text-[#4ADE80] transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(t.id)}
                        aria-label="Delete entry"
                        className="text-[#4A4D53] opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hover:text-[#F87171] transition"
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
      className={`pb-3 text-[15px] font-medium border-b-2 -mb-px transition-colors ${
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
function MonthCalendar({ calendar, hasData }) {
  const [cursor, setCursor] = useState(() => {
    const dates = Object.keys(calendar).map((d) => new Date(d));
    const latest = dates.length ? dates.sort((a, b) => b - a)[0] : new Date();
    return new Date(latest.getFullYear(), latest.getMonth(), 1);
  });

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
    <div className="p-4 sm:p-5">
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
          className={`h-9 px-4 rounded-lg text-sm font-medium border transition-colors ${
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
      <div className="flex gap-1.5 mb-1.5">
        <div className="grid grid-cols-7 gap-1.5 flex-1">
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
      <div className="space-y-1.5">
        {weeks.map((week, wi) => {
          const { pnl: weekPnl, days: weekDaysTraded } = weekTotals(week);

          return (
            <div key={wi} className="flex gap-1.5">
              <div className="grid grid-cols-7 gap-1.5 flex-1">
                {week.map((d, i) => {
                  if (d === null)
                    return <div key={i} className="min-h-[74px] sm:min-h-[104px] rounded-lg" />;

                  const key = toDateKey(new Date(year, month, d));
                  const info = calendar[key];
                  const traded = !!info;
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
                      className={`relative min-h-[74px] sm:min-h-[104px] rounded-lg border p-1.5 sm:p-2 flex flex-col ${tone} ${
                        key === todayKey ? "ring-1 ring-[#4ADE80]/60" : ""
                      }`}
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
                            className={`text-[10px] sm:text-[15px] font-bold truncate ${
                              flat ? "text-[#C9CBD1]" : win ? "text-[#4ADE80]" : "text-[#F87171]"
                            }`}
                            title={`${info.pnl < 0 ? "-" : ""}${currency(Math.abs(info.pnl))}`}
                          >
                            <span className="sm:hidden">{compact(info.pnl)}</span>
                            <span className="hidden sm:inline whitespace-nowrap">
                              {info.pnl < 0 ? "-" : ""}
                              {currency(Math.abs(info.pnl))}
                            </span>
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-[#8A8D94]">
                            {info.count}
                            <span className="hidden sm:inline"> trade{info.count > 1 ? "s" : ""}</span>
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-[#6E7076] hidden sm:block">
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
                  {weekDaysTraded === 0 ? "$0" : `${weekPnl < 0 ? "-" : ""}${currency(Math.abs(weekPnl))}`}
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
                className={`text-sm font-bold ${
                  weekDaysTraded === 0
                    ? "text-[#4A4D53]"
                    : weekPnl > 0
                    ? "text-[#4ADE80]"
                    : weekPnl < 0
                    ? "text-[#F87171]"
                    : "text-[#C9CBD1]"
                }`}
              >
                {weekDaysTraded === 0 ? "$0" : `${weekPnl < 0 ? "-" : ""}${currency(Math.abs(weekPnl))}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconArrow({ onClick, children, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E7076] hover:bg-[#17181B] hover:text-white transition-colors"
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
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
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
      className="h-9 pl-3.5 pr-8 rounded-lg bg-[#17181B] border border-[#232529] text-base sm:text-xs font-medium text-[#C9CBD1] hover:border-[#2E3137] focus:outline-none focus:ring-2 focus:ring-[#4ADE80]/25 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 10 10%22><path d=%22M2 4l3 3 3-3%22 fill=%22none%22 stroke=%22%236E7076%22 stroke-width=%221.4%22/></svg>')] bg-no-repeat bg-[right_0.6rem_center]"
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
   Add entry modal
   ------------------------------------------------------------------ */
function EntryModal({ entry, onSave, onClose }) {
  const isEdit = !!entry;
  const [date, setDate] = useState(entry?.date ?? toDateKey(new Date()));
  const [symbol, setSymbol] = useState(entry?.symbol ?? "");
  const [gross, setGross] = useState(entry ? String(entry.gross) : "");
  const [commission, setCommission] = useState(
    entry?.commission ? String(entry.commission) : ""
  );
  const [swap, setSwap] = useState(entry?.swap ? String(entry.swap) : "");
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
  const grossValid = !Number.isNaN(parseFloat(gross));
  const net = num(gross) + num(commission) + num(swap);

  function handleSubmit(e) {
    e.preventDefault();
    if (!grossValid) return;
    onSave({
      id: entry?.id,
      date,
      symbol: symbol.trim().toUpperCase(),
      gross: num(gross),
      commission: num(commission),
      swap: num(swap),
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
          <button onClick={onClose} aria-label="Close" className="text-[#6E7076] hover:text-white">
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
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="NAS100, XAUUSD, ES..."
              className={field}
            />
          </div>

          <div>
            <label className={labelCls}>Profit</label>
            <input
              type="number"
              step="0.01"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              placeholder="112.40"
              className={field}
              required
            />
            <p className="text-[11px] text-[#4A4D53] mt-1">
              The MT5 Profit column, before fees. Negative for a loss.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Commission</label>
              <input
                type="number"
                step="0.01"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="-0.70"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Swap</label>
              <input
                type="number"
                step="0.01"
                value={swap}
                onChange={(e) => setSwap(e.target.value)}
                placeholder="-1.47"
                className={field}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#4A4D53]">
            Copy both straight from MT5, minus sign included. Leave blank if the account charges neither.
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
            className="w-full bg-[#4ADE80] hover:bg-[#3ECF74] text-[#08130C] rounded-lg py-2.5 text-sm font-semibold mt-2 transition-colors"
          >
            {isEdit ? "Update entry" : "Save entry"}
          </button>
        </form>
      </div>
    </div>
  );
}