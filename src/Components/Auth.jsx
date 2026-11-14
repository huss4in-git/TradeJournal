import React, { useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { supabase, setRemember, getRemember } from "../lib/supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRememberState] = useState(getRemember());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const isSignUp = mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    setRemember(remember); // decides localStorage vs sessionStorage

    const fn = isSignUp ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { data, error } = await fn.call(supabase.auth, {
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is on, signUp returns a user with no session.
    if (isSignUp && !data.session) setSent(true);
    // Otherwise onAuthStateChange in App.jsx takes over from here.
  }

  async function handleReset() {
    if (!email.trim()) {
      setError("Enter your email first, then tap reset.");
      return;
    }
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    setError(error ? error.message : "Password reset link sent. Check your inbox.");
  }

  const field =
    "w-full bg-[color:var(--tl-field)] border border-[color:var(--tl-line)] rounded-xl px-4 py-3 text-base sm:text-sm text-[color:var(--tl-tx)] placeholder:text-[color:var(--tl-tx-5)] focus:outline-none focus:border-[color:var(--tl-pos-focus)] focus:ring-2 focus:ring-[color:var(--tl-pos-ring)] transition";

  return (
    <div className="relative min-h-screen bg-[color:var(--tl-bg)] text-[color:var(--tl-tx)] font-sans flex flex-col items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4" />

      <div className="mb-12">
        <Logo size={34} />
      </div>

      <div className="w-full max-w-[420px] relative">
        {/* thin lit edge along the top of the card, like a screen bezel catching light */}
        <div
          className="absolute -top-px left-10 right-10 h-px"
          style={{
            background: "linear-gradient(to right, transparent, var(--tl-pos-glow), transparent)",
          }}
        />

        <div className="bg-[color:var(--tl-surface)] border border-[color:var(--tl-line)] rounded-2xl p-7 sm:p-9">
          {sent ? (
            <div className="text-center py-6">
              <h1 className="text-xl font-semibold mb-2">Check your email</h1>
              <p className="text-sm text-[color:var(--tl-tx-3)] leading-relaxed">
                We sent a confirmation link to{" "}
                <span className="text-[color:var(--tl-tx-2)]">{email.trim()}</span>. Open it, then come back
                and sign in.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setMode("signin");
                  setPassword("");
                }}
                className="mt-6 text-sm font-medium text-[color:var(--tl-pos)] hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-[26px] font-semibold text-center tracking-tight">
                {isSignUp ? "Create your account" : "Sign in to Tradelog"}
              </h1>
              <p className="text-sm text-[color:var(--tl-tx-4)] text-center mt-2 mb-7">
                {isSignUp ? "Already have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(isSignUp ? "signin" : "signup");
                    setError("");
                  }}
                  className="text-[color:var(--tl-pos)] hover:underline font-medium"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={field}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignUp ? "At least 6 characters" : "Enter your password"}
                      className={`${field} pr-12`}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-tx-2)] p-1"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {!isSignUp && (
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        autoComplete="off" // stops the browser restoring a stale tick on reload
                        checked={remember}
                        onChange={(e) => setRememberState(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="w-4 h-4 rounded border border-[color:var(--tl-line-strong)] bg-[color:var(--tl-field)] flex items-center justify-center peer-checked:bg-[color:var(--tl-accent)] peer-checked:border-[color:var(--tl-accent)] transition-colors">
                        {remember && <Check size={12} className="text-[color:var(--tl-on-accent)]" strokeWidth={3} />}
                      </span>
                      <span className="text-xs text-[color:var(--tl-tx-3)]">Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-[color:var(--tl-tx-4)] hover:text-[color:var(--tl-pos)] transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-[color:var(--tl-neg)] bg-[color:var(--tl-neg-soft)] border border-[color:var(--tl-neg-line)] rounded-lg px-3 py-2.5 leading-relaxed">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 rounded-xl bg-[color:var(--tl-accent)] hover:bg-[color:var(--tl-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[color:var(--tl-on-accent)] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {isSignUp ? "Create account" : "Sign in"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-[color:var(--tl-tx-6)]">
        tradelog · {new Date().getFullYear()}
      </p>
    </div>
  );
}