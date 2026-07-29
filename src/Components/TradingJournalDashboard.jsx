import React, { useEffect, useMemo, useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Bell, User, Plus, Trash2, X, SlidersHorizontal, Calendar, ChevronDown } from "lucide-react";

const currency = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ------------------------------------------------------------
// Derived calculations — all computed from whatever entries
// exist. No mock data, no broker connection. Add an entry and
// every card below updates automatically.
// ------------------------------------------------------------
function computeStats(trades) {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const byDay = {};
  trades.forEach((t) => {
    byDay[t.date] = (byDay[t.date] || 0) + t.pnl;
  });
  const days = Object.values(byDay);
  const winDays = days.filter((d) => d >= 0).length;
  const dayWinRate = days.length ? (winDays / days.length) * 100 : 0;

  return { netPnl, winRate, avgWin, avgLoss, profitFactor, dayWinRate };
}

function buildEquityCurve(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;
  return sorted.map((t) => {
    running += t.pnl;
    return {
      date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      equity: running,
    };
  });
}

function buildCalendar(trades) {
  const byDay = {};
  trades.forEach((t) => {
    if (!byDay[t.date]) byDay[t.date] = { pnl: 0, count: 0, wins: 0 };
    byDay[t.date].pnl += t.pnl;
    byDay[t.date].count += 1;
    if (t.pnl >= 0) byDay[t.date].wins += 1;
  });
  return byDay;
}

function toDateKey(d) {
  // local-date key, e.g. "2026-07-29", avoids UTC shift bugs
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function TradingJournalDashboard() {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Load persisted entries on mount (falls back silently if storage isn't available)
  useEffect(() => {
    (async () => {
      if (!window.storage) {
        setLoaded(true);
        return;
      }
      try {
        const result = await window.storage.get("manual-trades", false);
        if (result?.value) setTrades(JSON.parse(result.value));
      } catch {
        // no saved data yet — start empty
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist whenever entries change (after initial load)
  useEffect(() => {
    if (!loaded || !window.storage) return;
    window.storage.set("manual-trades", JSON.stringify(trades), false).catch(() => {});
  }, [trades, loaded]);

  const stats = useMemo(() => computeStats(trades), [trades]);
  const equityCurve = useMemo(() => buildEquityCurve(trades), [trades]);
  const calendar = useMemo(() => buildCalendar(trades), [trades]);
  const hasData = trades.length > 0;

  function addEntry(entry) {
    setTrades((prev) => [...prev, { id: crypto.randomUUID(), ...entry }]);
    setShowForm(false);
  }

  function deleteEntry(id) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA] text-[#1B1D28] font-sans">
      {/* Top bar */}
      <div className="bg-[#15112B] px-6 py-3.5 flex items-center justify-between">
        <span className="text-white font-semibold text-lg tracking-tight">TradeLog</span>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Bell size={15} className="text-white" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
            <User size={15} className="text-[#15112B]" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white border border-[#E7E9EF] text-sm">
              <SlidersHorizontal size={14} className="text-[#8A8FA3]" />
              Filters
              <ChevronDown size={13} className="text-[#8A8FA3]" />
            </button>
            <button className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white border border-[#E7E9EF] text-sm">
              <Calendar size={14} className="text-[#8A8FA3]" />
              Jul 01 – Jul 29, 2026
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#6D5DF0] text-white text-sm font-medium"
            >
              <Plus size={15} />
              Add Entry
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <StatCard label="Net P&L" value={hasData ? currency(stats.netPnl) : "--"} positive={stats.netPnl >= 0} />
          <ArcCard label="Trade win %" value={hasData ? stats.winRate : null} />
          <ArcCard label="Profit factor" value={hasData ? stats.profitFactor : null} isRatio />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <ArcCard label="Day win %" value={hasData ? stats.dayWinRate : null} />
          <AvgWinLossCard avgWin={hasData ? stats.avgWin : null} avgLoss={hasData ? stats.avgLoss : null} />
        </div>

        {/* Equity curve */}
        <Card title="Equity Curve" className="mb-6">
          {hasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6D5DF0" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6D5DF0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEEFF3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#B2B6C4"
                  tick={{ fontSize: 11, fill: "#8A8FA3" }}
                  axisLine={{ stroke: "#EEEFF3" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#B2B6C4"
                  tick={{ fontSize: 11, fill: "#8A8FA3" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E7E9EF", borderRadius: 10, fontSize: 12 }}
                  formatter={(v) => [currency(v), "Equity"]}
                />
                <Area type="monotone" dataKey="equity" stroke="#6D5DF0" strokeWidth={2} fill="url(#equityFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No entries yet" hint="Tap Add Entry to log your first trade or daily P&L" />
          )}
        </Card>

        {/* Calendar */}
        <Card className="mb-6" noPad>
          <MonthCalendar calendar={calendar} hasData={hasData} />
        </Card>

        {/* Entries list */}
        <Card title="Entries" noPad>
          {hasData ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-[#8A8FA3] uppercase tracking-wide border-b border-[#EEEFF3]">
                  <th className="py-3 px-5 font-medium">Date</th>
                  <th className="py-3 px-5 font-medium">Symbol</th>
                  <th className="py-3 px-5 font-medium text-right">P&L</th>
                  <th className="py-3 px-5 font-medium text-right">Note</th>
                  <th className="py-3 px-5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {[...trades]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((t) => (
                    <tr key={t.id} className="border-b border-[#EEEFF3] last:border-0">
                      <td className="py-3 px-5 text-[#8A8FA3]">
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-5 font-medium">{t.symbol || "—"}</td>
                      <td
                        className={`py-3 px-5 text-right font-medium ${
                          t.pnl >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                        }`}
                      >
                        {t.pnl >= 0 ? "+" : ""}
                        {currency(t.pnl)}
                      </td>
                      <td className="py-3 px-5 text-right text-[#8A8FA3] text-xs">{t.note || ""}</td>
                      <td className="py-3 px-5">
                        <button onClick={() => deleteEntry(t.id)} className="text-[#B2B6C4] hover:text-[#DC2626]">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <div className="p-5">
              <EmptyState text="No entries yet" hint="Tap Add Entry to log your first trade or daily P&L" />
            </div>
          )}
        </Card>
      </div>

      {showForm && <AddEntryModal onAdd={addEntry} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ------------------------------------------------------------
// Add entry modal
// ------------------------------------------------------------
function AddEntryModal({ onAdd, onClose }) {
  const [date, setDate] = useState(toDateKey(new Date()));
  const [symbol, setSymbol] = useState("");
  const [pnl, setPnl] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const value = parseFloat(pnl);
    if (Number.isNaN(value)) return;
    onAdd({ date, symbol: symbol.trim(), pnl: value, note: note.trim() });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Add Entry</h3>
          <button onClick={onClose} className="text-[#8A8FA3]">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[#8A8FA3] block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-[#E7E9EF] rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-[#8A8FA3] block mb-1">Symbol (optional)</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="NAS100, XAUUSD, ES..."
              className="w-full border border-[#E7E9EF] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#8A8FA3] block mb-1">P&L ($)</label>
            <input
              type="number"
              step="0.01"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              placeholder="e.g. 150 or -80"
              className="w-full border border-[#E7E9EF] rounded-lg px-3 py-2 text-sm"
              required
            />
            <p className="text-[11px] text-[#B2B6C4] mt-1">Use a negative number for a loss.</p>
          </div>
          <div>
            <label className="text-xs text-[#8A8FA3] block mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Setup, mistake, mood..."
              className="w-full border border-[#E7E9EF] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#6D5DF0] text-white rounded-lg py-2.5 text-sm font-medium mt-2"
          >
            Add Entry
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Shared components
// ------------------------------------------------------------
function Card({ title, children, className = "", noPad }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E7E9EF] ${className}`}>
      {title && (
        <div className="px-5 pt-5 pb-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
      )}
      <div className={noPad ? "" : "p-5 pt-3"}>{children}</div>
    </div>
  );
}

function EmptyState({ text, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-full bg-[#F1F0FB] flex items-center justify-center mb-3">
        <Plus size={20} className="text-[#B7AEF0]" />
      </div>
      <p className="text-sm text-[#5B5F6E]">{text}</p>
      <p className="text-xs text-[#B2B6C4] mt-0.5">{hint}</p>
    </div>
  );
}

function StatCard({ label, value, positive }) {
  const color = value === "--" ? "text-[#B2B6C4]" : positive ? "text-[#16A34A]" : "text-[#DC2626]";
  return (
    <div className="bg-white rounded-2xl border border-[#E7E9EF] p-4">
      <p className="text-[11px] text-[#8A8FA3] uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ArcCard({ label, value, isRatio }) {
  const hasValue = value !== null && value !== undefined && !Number.isNaN(value);
  const pct = isRatio ? Math.min((value / 3) * 100, 100) : value;
  const radius = 26;
  const circumference = Math.PI * radius;
  const offset = hasValue ? circumference - (pct / 100) * circumference : 0;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E9EF] p-4 flex items-center justify-between">
      <div>
        <p className="text-[11px] text-[#8A8FA3] uppercase tracking-wide mb-2">{label}</p>
        <p className="text-xl font-semibold">
          {hasValue ? (isRatio ? value.toFixed(2) : `${value.toFixed(1)}%`) : "--"}
        </p>
      </div>
      <svg width="64" height="36" viewBox="0 0 64 36">
        <path d="M 6 32 A 26 26 0 0 1 58 32" fill="none" stroke="#EEEFF3" strokeWidth="6" strokeLinecap="round" />
        {hasValue && (
          <path
            d="M 6 32 A 26 26 0 0 1 58 32"
            fill="none"
            stroke={pct >= 50 ? "#16A34A" : "#DC2626"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>
    </div>
  );
}

function AvgWinLossCard({ avgWin, avgLoss }) {
  const hasValue = avgWin !== null && avgLoss !== null;
  const total = hasValue ? avgWin + avgLoss : 1;
  const winPct = hasValue && total > 0 ? (avgWin / total) * 100 : 50;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E9EF] p-4">
      <p className="text-[11px] text-[#8A8FA3] uppercase tracking-wide mb-2">Avg win / loss trade</p>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{hasValue ? currency(avgWin) : "--"}</span>
        <span className="text-sm font-semibold text-[#DC2626]">{hasValue ? `-${currency(avgLoss)}` : "--"}</span>
      </div>
      <div className="h-2 rounded-full bg-[#EEEFF3] overflow-hidden flex">
        <div className="h-full bg-[#16A34A]" style={{ width: `${winPct}%` }} />
        <div className="h-full bg-[#DC2626]" style={{ width: `${100 - winPct}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Month calendar with weekly summary column
// ------------------------------------------------------------
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

  let monthTotal = 0;
  let tradingDays = 0;
  Object.entries(calendar).forEach(([dateStr, info]) => {
    const dt = new Date(dateStr);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      monthTotal += info.pnl;
      tradingDays += 1;
    }
  });

  const weeks = chunkIntoWeeks(cells);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Monthly stats:</span>
          {hasData ? (
            <span
              className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                monthTotal >= 0 ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEE2E2] text-[#DC2626]"
              }`}
            >
              {monthTotal >= 0 ? "+" : ""}
              {currency(monthTotal)}
            </span>
          ) : (
            <span className="text-sm font-semibold text-[#B2B6C4]">--</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-7 h-7 rounded-full hover:bg-[#F5F6FA] text-[#8A8FA3] text-sm"
          >
            ←
          </button>
          <span className="text-sm font-medium w-32 text-center">
            {firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-7 h-7 rounded-full hover:bg-[#F5F6FA] text-[#8A8FA3] text-sm"
          >
            →
          </button>
          <span className="text-[11px] font-medium text-[#8A8FA3] bg-[#F5F6FA] rounded-full px-3 py-1">
            {hasData ? `${tradingDays} days` : "-- days"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] font-medium text-[#8A8FA3] py-1.5">
            {w}
          </div>
        ))}
        <div className="text-center text-[11px] font-medium text-[#8A8FA3] py-1.5">Week</div>
      </div>

      {weeks.map((week, wi) => {
        const weekPnl = week.reduce((sum, d) => {
          if (d === null) return sum;
          const info = calendar[toDateKey(new Date(year, month, d))];
          return sum + (info ? info.pnl : 0);
        }, 0);
        const weekDaysTraded = week.filter(
          (d) => d !== null && calendar[toDateKey(new Date(year, month, d))]
        ).length;
        const weekHasData = weekDaysTraded > 0;

        return (
          <div key={wi} className="grid grid-cols-8 gap-1.5 mb-1.5 last:mb-0">
            {week.map((d, i) => {
              if (d === null) return <div key={i} className="aspect-[4/5] sm:aspect-square" />;

              const info = calendar[toDateKey(new Date(year, month, d))];
              const hasTrades = !!info;
              const win = hasTrades && info.pnl >= 0;
              const winRate = hasTrades ? (info.wins / info.count) * 100 : null;

              return (
                <div
                  key={i}
                  className={`aspect-[4/5] sm:aspect-square rounded-lg p-1.5 sm:p-2 flex flex-col justify-between ${
                    hasTrades ? (win ? "bg-[#DCFCE7]" : "bg-[#FEE2E2]") : "bg-[#F9F9FB]"
                  }`}
                >
                  <span className={`text-[10px] sm:text-xs self-end ${hasTrades ? "text-[#1B1D28]" : "text-[#B2B6C4]"}`}>
                    {d}
                  </span>
                  {hasTrades && (
                    <div className="leading-tight">
                      <p className={`text-[10px] sm:text-sm font-semibold ${win ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {win ? "+" : ""}
                        {currency(info.pnl)}
                      </p>
                      <p className="text-[8px] sm:text-[10px] text-[#8A8FA3] hidden sm:block">
                        {info.count} trade{info.count > 1 ? "s" : ""}
                      </p>
                      <p className="text-[8px] sm:text-[10px] text-[#8A8FA3] hidden sm:block">{winRate.toFixed(0)}%</p>
                    </div>
                  )}
                </div>
              );
            })}

            <div
              className={`aspect-[4/5] sm:aspect-square rounded-lg p-1.5 sm:p-2 flex flex-col items-center justify-center text-center ${
                weekHasData ? "bg-[#EEEBFD]" : "bg-[#F9F9FB]"
              }`}
            >
              {weekHasData ? (
                <>
                  <p className={`text-[10px] sm:text-sm font-semibold ${weekPnl >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    {weekPnl >= 0 ? "+" : ""}
                    {currency(weekPnl)}
                  </p>
                  <p className="text-[8px] sm:text-[10px] text-[#8A8FA3] hidden sm:block">
                    {weekDaysTraded} day{weekDaysTraded > 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <span className="text-[9px] text-[#D0D3DC]">--</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function chunkIntoWeeks(cells) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}