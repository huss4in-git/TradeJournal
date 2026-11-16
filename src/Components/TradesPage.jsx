import React, { useMemo, useRef, useState } from "react";
import {
  CandlestickChart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button, Card, Empty, PageHeader, Pills, Stat, currency, inputClass, pnlColor } from "./ui";
import { parseTradesFile, tradeKey, tradesToCsv } from "../lib/importTrades";

const PAGE_SIZE = 50;

const COLUMNS = [
  { key: "date", label: "Close date", align: "left" },
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "gross", label: "Gross", align: "right" },
  { key: "commission", label: "Commission", align: "right" },
  { key: "swap", label: "Swap", align: "right" },
  { key: "pnl", label: "Net P&L", align: "right" },
];

const prettyDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/* ------------------------------------------------------------------
   Trades — the full log: search, filter, sort, import and export.
   ------------------------------------------------------------------ */
export default function TradesPage({ trades, onAdd, onEdit, onDelete, onImport }) {
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("all");
  const [result, setResult] = useState("all"); // all | win | loss | flat
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [page, setPage] = useState(0);
  const [confirmId, setConfirmId] = useState(null);
  const [importing, setImporting] = useState(false);

  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.symbol).filter(Boolean))].sort(),
    [trades]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = trades.filter((t) => {
      if (symbol !== "all" && t.symbol !== symbol) return false;
      if (result === "win" && !(t.pnl > 0)) return false;
      if (result === "loss" && !(t.pnl < 0)) return false;
      if (result === "flat" && t.pnl !== 0) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q && !`${t.symbol || ""} ${t.note || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const x = a[sort.key] ?? "";
      const y = b[sort.key] ?? "";
      if (x < y) return -dir;
      if (x > y) return dir;
      return a.id < b.id ? dir : -dir; // stable order for equal values
    });
  }, [trades, query, symbol, result, from, to, sort]);

  const summary = useMemo(() => {
    const net = filtered.reduce((s, t) => s + t.pnl, 0);
    const wins = filtered.filter((t) => t.pnl > 0).length;
    const fees = filtered.reduce((s, t) => s + (t.commission || 0) + (t.swap || 0), 0);
    return { net, wins, fees };
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const filtering = query || symbol !== "all" || result !== "all" || from || to;

  const change = (setter) => (value) => {
    setter(value);
    setPage(0);
  };

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "symbol" ? "asc" : "desc" }
    );

  const clearFilters = () => {
    setQuery("");
    setSymbol("all");
    setResult("all");
    setFrom("");
    setTo("");
    setPage(0);
  };

  const exportCsv = () => {
    const blob = new Blob([tradesToCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradelog-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-5 pb-6 sm:py-6">
      <PageHeader
        title="Trades"
        subtitle={`${trades.length} ${trades.length === 1 ? "entry" : "entries"} in your journal`}
      >
        <Button onClick={() => setImporting(true)}>
          <Upload size={14} /> Import
        </Button>
        <Button onClick={exportCsv} disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </Button>
        <Button primary onClick={onAdd}>
          <Plus size={14} /> Add Entry
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat label={filtering ? "Matching trades" : "Trades"} value={filtered.length} />
        <Stat label="Net P&L" value={currency(summary.net)} tone={pnlColor(summary.net)} />
        <Stat
          label="Win rate"
          value={filtered.length ? `${((summary.wins / filtered.length) * 100).toFixed(1)}%` : "—"}
          note={filtered.length ? `${summary.wins} of ${filtered.length} won` : null}
        />
        <Stat label="Commission + swap" value={currency(summary.fees)} tone={pnlColor(summary.fees)} />
      </div>

      <Card noPad>
        {/* Filters */}
        <div className="p-3.5 flex items-center gap-2 flex-wrap border-b border-[color:var(--tl-hair)]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--tl-tx-4)] pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => change(setQuery)(e.target.value)}
              placeholder="Search symbol or note…"
              aria-label="Search trades"
              className={`${inputClass} pl-9 w-56`}
            />
          </div>
          <select
            value={symbol}
            onChange={(e) => change(setSymbol)(e.target.value)}
            aria-label="Symbol"
            className={`${inputClass} cursor-pointer`}
          >
            <option value="all">All symbols</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Pills
            value={result}
            onChange={change(setResult)}
            options={[
              { value: "all", label: "All" },
              { value: "win", label: "Wins" },
              { value: "loss", label: "Losses" },
              { value: "flat", label: "Breakeven" },
            ]}
          />
          <label className="flex items-center gap-1.5 text-xs text-[color:var(--tl-tx-4)]">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => change(setFrom)(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[color:var(--tl-tx-4)]">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => change(setTo)(e.target.value)}
              className={inputClass}
            />
          </label>
          {filtering && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-pos)] cursor-pointer px-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {!trades.length ? (
          <Empty
            icon={CandlestickChart}
            text="No trades yet"
            hint="Add your first entry, or import your history from MetaTrader 5 or a CSV file."
          >
            <Button primary onClick={() => setImporting(true)}>
              <Upload size={14} /> Import trades
            </Button>
          </Empty>
        ) : !filtered.length ? (
          <Empty icon={Search} text="No trades match these filters">
            <Button onClick={clearFilters}>Clear filters</Button>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--tl-subtle)]">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        aria-sort={
                          sort.key === c.key
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        className={`px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider text-[color:var(--tl-tx-4)] whitespace-nowrap ${
                          c.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-[color:var(--tl-tx-2)] ${
                            sort.key === c.key ? "text-[color:var(--tl-tx-2)]" : ""
                          }`}
                        >
                          {c.label}
                          <ChevronDown
                            size={12}
                            className={`transition-transform ${
                              sort.key === c.key ? "opacity-100" : "opacity-0"
                            } ${sort.key === c.key && sort.dir === "asc" ? "rotate-180" : ""}`}
                          />
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider text-[color:var(--tl-tx-4)] text-left">
                      Note
                    </th>
                    <th className="px-4 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--tl-hair)]">
                  {rows.map((t) => (
                    <tr key={t.id} className="hover:bg-[color:var(--tl-row)]">
                      <td className="px-4 py-3 whitespace-nowrap text-[color:var(--tl-tx-2)]">
                        {prettyDate(t.date)}
                      </td>
                      <td className="px-4 py-3 font-medium">{t.symbol || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[color:var(--tl-tx-2)]">
                        {currency(t.gross)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[color:var(--tl-tx-3)]">
                        {t.commission ? currency(t.commission) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[color:var(--tl-tx-3)]">
                        {t.swap ? currency(t.swap) : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${pnlColor(t.pnl)}`}>
                        {currency(t.pnl)}
                      </td>
                      <td
                        className="px-4 py-3 text-[color:var(--tl-tx-3)] max-w-[280px] truncate"
                        title={t.note || undefined}
                      >
                        {t.note || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {confirmId === t.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDelete(t.id);
                                setConfirmId(null);
                              }}
                              className="h-7 px-2 rounded-md text-[11px] font-semibold cursor-pointer text-[color:var(--tl-neg)] bg-[color:var(--tl-neg-soft)] border border-[color:var(--tl-neg-line)] hover:border-[color:var(--tl-neg-line-strong)]"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              aria-label="Keep this trade"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md cursor-pointer text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-tx)]"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(t)}
                              aria-label={`Edit ${t.symbol || "trade"} on ${t.date}`}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md cursor-pointer text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-tx)] hover:bg-[color:var(--tl-subtle)]"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(t.id)}
                              aria-label={`Delete ${t.symbol || "trade"} on ${t.date}`}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md cursor-pointer text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-neg)] hover:bg-[color:var(--tl-neg-soft)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[color:var(--tl-hair)] text-xs text-[color:var(--tl-tx-4)]">
                <span>
                  {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page">
                    <ChevronLeft size={14} />
                  </Button>
                  <Button
                    onClick={() => setPage(current + 1)}
                    disabled={current >= pages - 1}
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {importing && (
        <ImportModal existing={trades} onImport={onImport} onClose={() => setImporting(false)} />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------
   Import: pick a file, review what was found, then add it.
   ------------------------------------------------------------------ */
function ImportModal({ existing, onImport, onClose }) {
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null); // { rows, source, fileName }
  const [error, setError] = useState("");
  const [skipDupes, setSkipDupes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  async function pick(file) {
    if (!file) return;
    setError("");
    setParsed(null);
    try {
      const res = await parseTradesFile(file);
      if (res.error) setError(res.error);
      else setParsed({ ...res, fileName: file.name });
    } catch {
      setError("This file could not be read.");
    }
  }

  const review = useMemo(() => {
    if (!parsed) return null;
    // Count-aware matching: importing two identical trades when the journal
    // holds one of them should still add the second.
    const have = {};
    existing.forEach((t) => {
      const k = tradeKey(t);
      have[k] = (have[k] || 0) + 1;
    });
    const fresh = [];
    let dupes = 0;
    parsed.rows.forEach((r) => {
      const k = tradeKey(r);
      if (have[k] > 0) {
        have[k] -= 1;
        dupes += 1;
      } else fresh.push(r);
    });
    const dates = parsed.rows.map((r) => r.date).sort();
    return { fresh, dupes, first: dates[0], last: dates[dates.length - 1] };
  }, [parsed, existing]);

  const toAdd = review ? (skipDupes ? review.fresh : parsed.rows) : [];
  const total = toAdd.reduce((s, r) => s + r.gross + r.commission + r.swap, 0);

  async function confirm() {
    setBusy(true);
    setError("");
    const res = await onImport(toAdd);
    setBusy(false);
    if (res.error) setError(res.error);
    else setDone(res.count);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[color:var(--tl-scrim)] backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import trades"
        className="w-full max-w-[520px] bg-[color:var(--tl-surface)] border border-[color:var(--tl-line)] rounded-2xl p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Import trades</h2>
            <p className="text-xs text-[color:var(--tl-tx-4)] mt-0.5">
              A MetaTrader 5 history report (HTML), or any CSV file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1 text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-tx)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {done != null ? (
          <div className="text-center py-6">
            <p className="text-sm text-[color:var(--tl-tx-2)]">
              {done} {done === 1 ? "trade" : "trades"} added to your journal.
            </p>
            <div className="mt-5">
              <Button primary onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,.csv,.txt"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-[color:var(--tl-line-strong)] bg-[color:var(--tl-field)] px-4 py-6 text-center cursor-pointer hover:border-[color:var(--tl-pos-focus)] transition-colors"
            >
              <Upload size={18} className="mx-auto text-[color:var(--tl-tx-3)]" />
              <p className="text-sm text-[color:var(--tl-tx-2)] mt-2">
                {parsed ? parsed.fileName : "Choose a file"}
              </p>
              <p className="text-xs text-[color:var(--tl-tx-4)] mt-0.5">
                {parsed ? "Click to choose a different file" : ".html or .csv"}
              </p>
            </button>

            {!parsed && !error && (
              <div className="mt-4 text-xs text-[color:var(--tl-tx-4)] leading-relaxed space-y-1.5">
                <p>
                  <span className="text-[color:var(--tl-tx-2)] font-medium">MetaTrader 5:</span> open the
                  History tab, right-click, choose Report, then HTML.
                </p>
                <p>
                  <span className="text-[color:var(--tl-tx-2)] font-medium">CSV:</span> needs a header row
                  with a date column and a profit column. Symbol, commission, swap and note are picked up
                  when present.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs text-[color:var(--tl-neg)] bg-[color:var(--tl-neg-soft)] border border-[color:var(--tl-neg-line)] rounded-lg px-3 py-2.5 leading-relaxed">
                {error}
              </p>
            )}

            {review && (
              <div className="mt-4">
                <div className="rounded-xl border border-[color:var(--tl-line)] divide-y divide-[color:var(--tl-hair)] text-sm">
                  <Row label="Found in file" value={`${parsed.rows.length} trades (${parsed.source})`} />
                  <Row
                    label="Dates"
                    value={
                      review.first === review.last
                        ? prettyDate(review.first)
                        : `${prettyDate(review.first)} to ${prettyDate(review.last)}`
                    }
                  />
                  <Row label="Already in your journal" value={review.dupes} />
                  <Row
                    label="Will be added"
                    value={`${toAdd.length} trades, net ${currency(total)}`}
                    strong
                  />
                </div>

                {review.dupes > 0 && (
                  <label className="mt-3 flex items-center gap-2 text-xs text-[color:var(--tl-tx-3)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDupes}
                      onChange={(e) => setSkipDupes(e.target.checked)}
                      className="accent-[color:var(--tl-accent)]"
                    />
                    Skip the {review.dupes} already in your journal
                  </label>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button onClick={onClose} disabled={busy}>
                    Cancel
                  </Button>
                  <Button primary onClick={confirm} disabled={busy || !toAdd.length}>
                    {busy ? "Adding…" : `Add ${toAdd.length} ${toAdd.length === 1 ? "trade" : "trades"}`}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
      <span className="text-xs text-[color:var(--tl-tx-4)]">{label}</span>
      <span
        className={`text-right tabular-nums ${
          strong ? "font-semibold text-[color:var(--tl-tx)]" : "text-[color:var(--tl-tx-2)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}