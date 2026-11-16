import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import {
  Card,
  Empty,
  GREEN,
  PageHeader,
  Pills,
  RED,
  Stat,
  axisTick,
  compact,
  currency,
  itemStyle,
  labelStyle,
  pnlColor,
  tooltipStyle,
} from "./ui";

const RANGES = [
  { value: "month", label: "This month" },
  { value: "90d", label: "90 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (key) =>
  fromKey(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function rangeStart(range) {
  const now = new Date();
  if (range === "month") return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  if (range === "90d") return dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
  if (range === "year") return `${now.getFullYear()}-01-01`;
  return "";
}

/* ------------------------------------------------------------------
   All the numbers on the page, from one list of trades.
   ------------------------------------------------------------------ */
export function buildReport(trades) {
  const sorted = [...trades].sort((a, b) =>
    a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1
  );
  const count = sorted.length;
  const wins = sorted.filter((t) => t.pnl > 0);
  const losses = sorted.filter((t) => t.pnl < 0);
  const sum = (list, f = (t) => t.pnl) => list.reduce((s, t) => s + f(t), 0);
  const net = sum(sorted);
  const grossWin = sum(wins);
  const grossLoss = Math.abs(sum(losses));

  // Longest runs of consecutive winners and losers. A breakeven ends both.
  let winStreak = 0;
  let lossStreak = 0;
  let w = 0;
  let l = 0;
  sorted.forEach((t) => {
    w = t.pnl > 0 ? w + 1 : 0;
    l = t.pnl < 0 ? l + 1 : 0;
    winStreak = Math.max(winStreak, w);
    lossStreak = Math.max(lossStreak, l);
  });

  // One point per trading day: running total, and how far it sits below
  // the highest total reached so far (the drawdown).
  const byDay = {};
  sorted.forEach((t) => {
    byDay[t.date] = (byDay[t.date] || 0) + t.pnl;
  });
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const days = Object.keys(byDay)
    .sort()
    .map((key) => {
      equity += byDay[key];
      peak = Math.max(peak, equity);
      const drawdown = equity - peak; // zero or negative
      maxDrawdown = Math.min(maxDrawdown, drawdown);
      return { key, label: shortDate(key), pnl: byDay[key], equity, drawdown };
    });

  const group = (keyOf) => {
    const map = {};
    sorted.forEach((t) => {
      const k = keyOf(t);
      const g = (map[k] ||= { key: k, count: 0, wins: 0, net: 0 });
      g.count += 1;
      g.net += t.pnl;
      if (t.pnl > 0) g.wins += 1;
    });
    return Object.values(map);
  };

  const symbols = group((t) => t.symbol || "No symbol").sort((a, b) => b.net - a.net);

  const weekdayMap = Object.fromEntries(group((t) => fromKey(t.date).getDay()).map((g) => [g.key, g]));
  // Monday to Friday always; weekend days only if something was traded then.
  const weekdays = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => (d >= 1 && d <= 5) || weekdayMap[d])
    .map((d) => ({ label: WEEKDAYS[d], count: 0, wins: 0, net: 0, ...weekdayMap[d] }));

  const months = group((t) => t.date.slice(0, 7))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(-12)
    .map((g) => ({
      ...g,
      label: fromKey(`${g.key}-01`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    }));

  const ranked = [...days].sort((a, b) => b.pnl - a.pnl);

  return {
    count,
    net,
    wins: wins.length,
    losses: losses.length,
    winRate: count ? (wins.length / count) * 100 : 0,
    // No losing trades means the ratio is undefined, not infinite profit.
    profitFactor: grossLoss ? grossWin / grossLoss : null,
    expectancy: count ? net / count : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    fees: sum(sorted, (t) => (t.commission || 0) + (t.swap || 0)),
    winStreak,
    lossStreak,
    maxDrawdown,
    days,
    symbols,
    weekdays,
    months,
    bestDays: ranked.filter((d) => d.pnl > 0).slice(0, 3),
    worstDays: ranked.filter((d) => d.pnl < 0).slice(-3).reverse(),
  };
}

/* ------------------------------------------------------------------
   Reports — where the money is made and lost.
   ------------------------------------------------------------------ */
export default function ReportsPage({ trades }) {
  const [range, setRange] = useState("all");

  const scoped = useMemo(() => {
    const start = rangeStart(range);
    return start ? trades.filter((t) => t.date >= start) : trades;
  }, [trades, range]);
  const r = useMemo(() => buildReport(scoped), [scoped]);

  const maxSymbol = Math.max(1, ...r.symbols.map((s) => Math.abs(s.net)));

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-5 pb-6 sm:py-6">
      <PageHeader title="Reports" subtitle="Where your profit comes from, and where it leaks">
        <Pills value={range} onChange={setRange} options={RANGES} />
      </PageHeader>

      {!r.count ? (
        <Card>
          <Empty
            icon={BarChart3}
            text={trades.length ? "No trades in this period" : "No trades yet"}
            hint={
              trades.length
                ? "Pick a longer period above."
                : "Reports fill in as soon as you log or import trades."
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat
              label="Net P&L"
              value={currency(r.net)}
              tone={pnlColor(r.net)}
              note={`${r.count} ${r.count === 1 ? "trade" : "trades"}`}
            />
            <Stat
              label="Profit factor"
              value={r.profitFactor == null ? "—" : r.profitFactor.toFixed(2)}
              note={r.profitFactor == null ? "No losing trades" : "Gross profit ÷ gross loss"}
            />
            <Stat
              label="Average per trade"
              value={currency(r.expectancy)}
              tone={pnlColor(r.expectancy)}
              note="Expectancy"
            />
            <Stat
              label="Win rate"
              value={`${r.winRate.toFixed(1)}%`}
              note={`${r.wins} won, ${r.losses} lost`}
            />
            <Stat
              label="Max drawdown"
              value={currency(r.maxDrawdown)}
              tone={pnlColor(r.maxDrawdown)}
              note="Largest drop from a peak"
            />
            <Stat
              label="Average win / loss"
              value={`${currency(r.avgWin)} / ${currency(-r.avgLoss)}`}
              note={r.avgLoss ? `Ratio ${(r.avgWin / r.avgLoss).toFixed(2)}` : null}
            />
            <Stat
              label="Longest streaks"
              value={`${r.winStreak} W / ${r.lossStreak} L`}
              note="Consecutive trades"
            />
            <Stat
              label="Commission + swap"
              value={currency(r.fees)}
              tone={pnlColor(r.fees)}
              note="Included in net P&L"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <Card title="P&L by weekday" hint="Which days of the week pay">
              <BarsChart data={r.weekdays} name="Net" />
            </Card>
            <Card title="P&L by month" hint="Last 12 months with trades">
              <BarsChart data={r.months} name="Net" />
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
            <Card title="By symbol" hint="Sorted by net P&L" noPad className="xl:col-span-2">
              <div className="overflow-x-auto pt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-[color:var(--tl-tx-4)]">
                      <th className="px-5 py-2 text-left font-medium">Symbol</th>
                      <th className="px-3 py-2 text-right font-medium">Trades</th>
                      <th className="px-3 py-2 text-right font-medium">Win rate</th>
                      <th className="px-3 py-2 text-right font-medium">Average</th>
                      <th className="px-3 py-2 text-right font-medium">Net P&L</th>
                      <th className="px-5 py-2 w-[30%]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--tl-hair)]">
                    {r.symbols.map((s) => (
                      <tr key={s.key}>
                        <td className="px-5 py-2.5 font-medium">{s.key}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[color:var(--tl-tx-2)]">
                          {s.count}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[color:var(--tl-tx-2)]">
                          {((s.wins / s.count) * 100).toFixed(0)}%
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${pnlColor(s.net / s.count)}`}>
                          {currency(s.net / s.count)}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${pnlColor(s.net)}`}>
                          {currency(s.net)}
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="h-1.5 rounded-full bg-[color:var(--tl-track)] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(Math.abs(s.net) / maxSymbol) * 100}%`,
                                background: s.net >= 0 ? GREEN : RED,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Best and worst days">
              <DayList title="Best" days={r.bestDays} empty="No winning days yet" />
              <div className="h-px bg-[color:var(--tl-hair)] my-3" />
              <DayList title="Worst" days={r.worstDays} empty="No losing days" />
            </Card>
          </div>

          <Card title="Drawdown" hint="How far below your highest running total you were, day by day">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={r.days} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--tl-hair)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--tl-hair)"
                  tick={axisTick}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={54} tickFormatter={compact} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={itemStyle}
                  labelStyle={labelStyle}
                  formatter={(v) => [currency(v), "Below peak"]}
                />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  baseValue={0}
                  stroke={RED}
                  strokeWidth={2}
                  fill={RED}
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </main>
  );
}

function BarsChart({ data, name }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="var(--tl-hair)" vertical={false} />
        <XAxis dataKey="label" stroke="var(--tl-hair)" tick={axisTick} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={54} tickFormatter={compact} />
        <ReferenceLine y={0} stroke="var(--tl-tx-5)" />
        <Tooltip
          cursor={{ fill: "var(--tl-subtle)" }}
          contentStyle={tooltipStyle}
          itemStyle={itemStyle}
          labelStyle={labelStyle}
          formatter={(v, _n, item) => [
            `${currency(v)} · ${item?.payload?.count ?? 0} trades`,
            name,
          ]}
        />
        <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.net >= 0 ? GREEN : RED} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DayList({ title, days, empty }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[color:var(--tl-tx-4)] font-medium mb-2">
        {title}
      </p>
      {days.length ? (
        <ul className="space-y-2">
          {days.map((d) => (
            <li key={d.key} className="flex items-center justify-between text-sm">
              <span className="text-[color:var(--tl-tx-2)]">
                {fromKey(d.key).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className={`tabular-nums font-semibold ${pnlColor(d.pnl)}`}>{currency(d.pnl)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--tl-tx-4)]">{empty}</p>
      )}
    </div>
  );
}