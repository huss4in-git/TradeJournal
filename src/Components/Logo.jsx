import React from "react";

/*
  tradelog logo — ascending bars. Mint on near-black in dark mode; in light
  mode the ramp flips so the tallest bar is still the strongest one.

  <Logo />                full lockup for the top bar
  <Logo mark />           bars only, for a collapsed nav or favicon
  <Logo size={32} />      scales the whole lockup from one number
  <Logo boxed />          bars inside a rounded tile, better at small sizes
*/

// The boxed tile is always dark, like the app icon, so its bars keep the
// fixed mint ramp. The bare mark sits on the page and follows the theme.
const FIXED = ["#1E5138", "#2F7D51", "#4ADE80"];
const THEMED = ["var(--tl-logo-1)", "var(--tl-logo-2)", "var(--tl-logo-3)"];

export function LogoMark({ size = 26, boxed = false }) {
  const [short, mid, tall] = boxed ? FIXED : THEMED;

  // Three bars rising left to right, aligned on a common baseline.
  const bars = (
    <>
      <rect x="2" y="20" width="7" height="14" rx="2" style={{ fill: short }} />
      <rect x="13" y="12" width="7" height="22" rx="2" style={{ fill: mid }} />
      <rect x="24" y="0" width="7" height="34" rx="2" style={{ fill: tall }} />
    </>
  );

  if (boxed) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        role="img"
        aria-label="tradelog"
        className="shrink-0"
      >
        <rect width="44" height="44" rx="11" fill="#101A14" stroke="#24402F" strokeWidth="1" />
        <g transform="translate(6.5, 5)">{bars}</g>
      </svg>
    );
  }

  return (
    <svg
      width={(size * 33) / 34}
      height={size}
      viewBox="0 0 33 34"
      role="img"
      aria-label="tradelog"
      className="shrink-0"
    >
      {bars}
    </svg>
  );
}

export default function Logo({ mark = false, boxed = false, size = 24, className = "" }) {
  if (mark) return <LogoMark size={size} boxed={boxed} />;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} boxed={boxed} />
      <span
        className="font-medium tracking-tight leading-none text-[color:var(--tl-tx)]"
        style={{ fontSize: size * 0.78 }}
      >
        trade<span className="text-[color:var(--tl-pos-fill)]">log</span>
      </span>
    </div>
  );
}