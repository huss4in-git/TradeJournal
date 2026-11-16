import React from "react";

/* ------------------------------------------------------------------
   Small building blocks shared by the pages behind the left rail
   (Trades, Reports, ...). Colours come from src/theme.css.
   ------------------------------------------------------------------ */

export const GREEN = "var(--tl-pos-fill)";
export const RED = "var(--tl-neg-fill)";

// Exact dollars and cents, e.g. $105.23
export const currency = (n) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Short form for chart axes: $350, -$1.2k
export const compact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
};

// Text colour for a profit / loss / breakeven amount.
export const pnlColor = (n) =>
  n > 0
    ? "text-[color:var(--tl-pos)]"
    : n < 0
    ? "text-[color:var(--tl-neg)]"
    : "text-[color:var(--tl-tx-3)]";

// Recharts tooltip styling, matching the dashboard's.
export const tooltipStyle = {
  background: "var(--tl-pop)",
  border: "1px solid var(--tl-pop-line)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "var(--tl-pop-shadow)",
};
export const itemStyle = { color: "var(--tl-tx)" };
export const labelStyle = { color: "var(--tl-tx-4)", fontSize: 11 };
export const axisTick = { fontSize: 11, fill: "var(--tl-tx-4)" };

export function Card({ title, hint, action, children, className = "", noPad }) {
  return (
    <div
      className={`bg-[color:var(--tl-surface)] rounded-2xl border border-[color:var(--tl-line)] ${className}`}
    >
      {title && (
        <div className="px-5 pt-5 pb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {hint && <p className="text-xs text-[color:var(--tl-tx-4)] mt-0.5">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={noPad ? "" : title ? "p-5 pt-3" : "p-4"}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3 pt-5 sm:pt-0">
      <div>
        {/* On phones the fixed header already shows the page name. */}
        <h1 className="hidden sm:block text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[color:var(--tl-tx-4)] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

// One number with a label above it and an optional note below.
export function Stat({ label, value, note, tone }) {
  return (
    <div className="bg-[color:var(--tl-surface)] rounded-2xl border border-[color:var(--tl-line)] p-4">
      <p className="text-[11px] uppercase tracking-wider text-[color:var(--tl-tx-4)] font-medium">
        {label}
      </p>
      <p className={`text-xl font-semibold mt-1.5 tabular-nums ${tone || ""}`}>{value}</p>
      {note && <p className="text-xs text-[color:var(--tl-tx-4)] mt-0.5">{note}</p>}
    </div>
  );
}

// Secondary button (outlined) and primary button (filled green).
export function Button({ primary, className = "", children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        primary
          ? "bg-[color:var(--tl-accent)] hover:bg-[color:var(--tl-accent-hover)] text-[color:var(--tl-on-accent)] font-semibold"
          : "bg-[color:var(--tl-raised)] border border-[color:var(--tl-line)] text-[color:var(--tl-tx-2)] hover:border-[color:var(--tl-line-strong)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Row of mutually exclusive choices, e.g. All / Wins / Losses.
export function Pills({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-[color:var(--tl-line)] bg-[color:var(--tl-raised)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            value === o.value
              ? "bg-[color:var(--tl-pos-soft)] text-[color:var(--tl-pos)]"
              : "text-[color:var(--tl-tx-3)] hover:text-[color:var(--tl-tx-2)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputClass =
  "h-9 rounded-lg bg-[color:var(--tl-raised)] border border-[color:var(--tl-line)] px-3 text-xs text-[color:var(--tl-tx-2)] placeholder:text-[color:var(--tl-tx-5)] focus:outline-none focus:border-[color:var(--tl-pos-focus)] focus:ring-2 focus:ring-[color:var(--tl-pos-ring)] transition";

export function Empty({ icon: Icon, text, hint, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-[color:var(--tl-pos-soft)] border border-[color:var(--tl-pos-line)] flex items-center justify-center mb-3">
          <Icon size={20} className="text-[color:var(--tl-pos)]" />
        </div>
      )}
      <p className="text-sm text-[color:var(--tl-tx-2)]">{text}</p>
      {hint && <p className="text-xs text-[color:var(--tl-tx-4)] mt-1 max-w-[340px]">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}