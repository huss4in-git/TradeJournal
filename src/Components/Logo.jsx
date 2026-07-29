import React from "react";

/*
  tradelog logo — ascending bars, mint on near-black.

  <Logo />                full lockup for the top bar
  <Logo mark />           bars only, for a collapsed nav or favicon
  <Logo size={32} />      scales the whole lockup from one number
  <Logo boxed />          bars inside a rounded tile, better at small sizes
*/

const GREEN = "#4ADE80";
const GREEN_MID = "#2F7D51";
const GREEN_DARK = "#1E5138";

export function LogoMark({ size = 26, boxed = false }) {
  // Three bars rising left to right, aligned on a common baseline.
  const bars = (
    <>
      <rect x="2" y="20" width="7" height="14" rx="2" fill={GREEN_DARK} />
      <rect x="13" y="12" width="7" height="22" rx="2" fill={GREEN_MID} />
      <rect x="24" y="0" width="7" height="34" rx="2" fill={GREEN} />
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
        className="font-medium tracking-tight leading-none text-white"
        style={{ fontSize: size * 0.78 }}
      >
        trade<span className="text-[#4ADE80]">log</span>
      </span>
    </div>
  );
}