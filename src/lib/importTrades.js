// Turns an exported file into journal entries. Two kinds are understood:
//
//   1. A MetaTrader 5 history report saved as HTML
//      (History tab -> right-click -> Report -> HTML).
//   2. Any CSV with a header row that has at least a date and a profit column.
//
// Every parser returns rows shaped like the journal stores them:
//   { date: "2026-11-13", symbol, gross, commission, swap, note }
// Signs are kept exactly as the platform shows them: a commission charged
// is negative, a swap credited is positive.

const num = (v) => {
    if (v == null) return NaN;
    // "1 234.56", "-0.70", "1,234.56", "(12.00)"
    let s = String(v).replace(/ /g, " ").trim();
    if (!s) return NaN;
    const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
    s = s.replace(/[()\s$€£]/g, "").replace(/^[-+]/, "");
    // Decimal comma ("12,50") vs thousands comma ("1,234.50").
    if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? (negative ? -n : n) : NaN;
  };
  
  // "2026.11.13 14:32:10", "2026-11-13", "13/11/2026", "11/13/2026 2:30 PM"
  export function toDate(v) {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
    if (m) {
      let [, a, b, y] = m;
      // Day first unless that can't be right (13th month).
      let day = a;
      let month = b;
      if (Number(b) > 12 && Number(a) <= 12) {
        day = b;
        month = a;
      }
      return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return null;
  }
  
  /* ------------------------------------------------------------------
     MetaTrader 5 HTML report
     ------------------------------------------------------------------ */
  function parseMt5Html(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = [...doc.querySelectorAll("tr")];
    const cellsOf = (tr) =>
      [...tr.children]
        // MT5 pads rows with hidden cells; they'd shift every column.
        .filter((c) => !/\bhidden\b/.test(c.className || "") && c.style?.display !== "none")
        .map((c) => c.textContent.replace(/ /g, " ").trim());
  
    // The "Positions" table: one row per closed trade.
    const start = rows.findIndex((tr) => /^\s*positions\s*$/i.test(tr.textContent));
    if (start === -1) return null;
  
    const header = cellsOf(rows[start + 1] || rows[start]).map((h) => h.toLowerCase());
    const find = (name, from = 0) => header.findIndex((h, i) => i >= from && h === name);
    const iSymbol = find("symbol");
    const iType = find("type");
    const iVolume = find("volume");
    const iCommission = find("commission");
    const iSwap = find("swap");
    const iProfit = find("profit");
    // Two "Time" columns: open, then close. Use the close time.
    const iOpen = find("time");
    const iClose = find("time", iOpen + 1);
    if (iProfit === -1 || iOpen === -1) return null;
  
    const out = [];
    for (let r = start + 2; r < rows.length; r++) {
      const cells = cellsOf(rows[r]);
      // The next section title ("Orders", "Deals") or the totals row ends it.
      if (cells.length < header.length - 2) break;
      const date = toDate(cells[iClose !== -1 ? iClose : iOpen]) || toDate(cells[iOpen]);
      const gross = num(cells[iProfit]);
      if (!date || Number.isNaN(gross)) continue;
      const type = iType !== -1 ? cells[iType] : "";
      const volume = iVolume !== -1 ? cells[iVolume] : "";
      out.push({
        date,
        symbol: (iSymbol !== -1 ? cells[iSymbol] : "").toUpperCase() || null,
        gross,
        commission: iCommission !== -1 ? num(cells[iCommission]) || 0 : 0,
        swap: iSwap !== -1 ? num(cells[iSwap]) || 0 : 0,
        note: [type, volume].filter(Boolean).join(" ") || null,
      });
    }
    return out;
  }
  
  /* ------------------------------------------------------------------
     CSV
     ------------------------------------------------------------------ */
  // Splits CSV text into rows of cells. Handles quotes, commas inside quotes,
  // doubled quotes, and ; or tab as the separator.
  export function parseCsvText(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const sep = [",", ";", "\t"].sort(
      (a, b) => firstLine.split(b).length - firstLine.split(a).length
    )[0];
  
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((c) => c.trim() !== "")) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    return rows;
  }
  
  const COLUMN_NAMES = {
    date: ["close date", "close time", "closed", "date", "time", "entry_date", "exit date", "exit time"],
    symbol: ["symbol", "instrument", "pair", "ticker", "market"],
    net: ["net p&l", "net pnl", "net_pnl", "net profit", "net"],
    gross: ["gross p&l", "gross pnl", "gross", "profit", "pnl", "p&l", "p/l", "pl"],
    commission: ["commission", "commissions", "fee", "fees"],
    swap: ["swap", "swaps", "rollover"],
    note: ["note", "notes", "comment", "reason"],
  };
  
  function parseCsv(text) {
    const rows = parseCsvText(text);
    if (rows.length < 2) return null;
    const header = rows[0].map((h) => h.replace(/^﻿/, "").trim().toLowerCase());
    const col = (key) => {
      for (const name of COLUMN_NAMES[key]) {
        const i = header.indexOf(name);
        if (i !== -1) return i;
      }
      return -1;
    };
    const iDate = col("date");
    const iGross = col("gross");
    const iNet = col("net");
    if (iDate === -1 || (iGross === -1 && iNet === -1)) return null;
    const iSymbol = col("symbol");
    const iCommission = col("commission");
    const iSwap = col("swap");
    const iNote = col("note");
  
    const out = [];
    for (const cells of rows.slice(1)) {
      const date = toDate(cells[iDate]);
      const commission = iCommission !== -1 ? num(cells[iCommission]) || 0 : 0;
      const swap = iSwap !== -1 ? num(cells[iSwap]) || 0 : 0;
      // Prefer a gross column. With only a net column, back the fees out so
      // the journal's own net (gross + commission + swap) matches the file.
      let gross = iGross !== -1 ? num(cells[iGross]) : NaN;
      if (Number.isNaN(gross) && iNet !== -1) {
        const net = num(cells[iNet]);
        if (!Number.isNaN(net)) gross = net - commission - swap;
      }
      if (!date || Number.isNaN(gross)) continue;
      out.push({
        date,
        symbol: (iSymbol !== -1 ? cells[iSymbol] : "").trim().toUpperCase() || null,
        gross: Math.round(gross * 100) / 100,
        commission,
        swap,
        note: (iNote !== -1 ? cells[iNote] : "").trim() || null,
      });
    }
    return out;
  }
  
  /* ------------------------------------------------------------------
     Entry points
     ------------------------------------------------------------------ */
  // MT5 saves its HTML report as UTF-16; CSVs are normally UTF-8.
  async function readText(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const utf16 =
      (buf[0] === 0xff && buf[1] === 0xfe) || (buf.length > 3 && buf[1] === 0 && buf[3] === 0);
    return new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(buf);
  }
  
  export function parseTradesText(text, fileName = "") {
    const looksHtml = /\.html?$/i.test(fileName) || /<table|<html/i.test(text.slice(0, 2000));
    if (looksHtml) {
      const rows = parseMt5Html(text);
      if (rows?.length) return { rows, source: "MetaTrader 5 report" };
      return {
        rows: [],
        error:
          "No closed positions were found in this report. Export it from MT5 with History -> right-click -> Report -> HTML.",
      };
    }
    const rows = parseCsv(text);
    if (rows?.length) return { rows, source: "CSV file" };
    return {
      rows: [],
      error:
        "This file could not be read. A CSV needs a header row with at least a date column and a profit column.",
    };
  }
  
  export async function parseTradesFile(file) {
    if (/\.xlsx?$/i.test(file.name)) {
      return {
        rows: [],
        error:
          "Excel files can't be read directly. In MT5 choose Report -> HTML instead, or save the sheet as CSV.",
      };
    }
    return parseTradesText(await readText(file), file.name);
  }
  
  // Two entries count as the same trade when everything the journal stores
  // about them matches. Used to skip rows already imported.
  export const tradeKey = (t) =>
    [t.date, t.symbol || "", t.gross.toFixed(2), (t.commission || 0).toFixed(2), (t.swap || 0).toFixed(2)].join("|");
  
  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */
  export function tradesToCsv(trades) {
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [["Date", "Symbol", "Gross", "Commission", "Swap", "Net", "Note"].join(",")];
    trades.forEach((t) =>
      lines.push(
        [
          t.date,
          t.symbol || "",
          t.gross.toFixed(2),
          (t.commission || 0).toFixed(2),
          (t.swap || 0).toFixed(2),
          t.pnl.toFixed(2),
          t.note || "",
        ]
          .map(esc)
          .join(",")
      )
    );
    return lines.join("\r\n");
  }