import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "./Logo";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const isSignUp = mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

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
    "w-full bg-[#0D0E10] border border-[#232529] rounded-xl px-4 py-3 text-sm text-white placeholder-[#4A4D53] focus:outline-none focus:border-[#4ADE80]/50 focus:ring-2 focus:ring-[#4ADE80]/15 transition";

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-12">
        <Logo size={34} />
      </div>

      <div className="w-full max-w-[420px] relative">
        {/* thin lit edge along the top of the card, like a screen bezel catching light */}
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#4ADE80]/40 to-transparent" />

        <div className="bg-[#121316] border border-[#232529] rounded-2xl p-7 sm:p-9">
          {sent ? (
            <div className="text-center py-6">
              <h1 className="text-xl font-semibold mb-2">Check your email</h1>
              <p className="text-sm text-[#8A8D94] leading-relaxed">
                We sent a confirmation link to{" "}
                <span className="text-[#C9CBD1]">{email.trim()}</span>. Open it, then come back
                and sign in.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setMode("signin");
                  setPassword("");
                }}
                className="mt-6 text-sm font-medium text-[#4ADE80] hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-[26px] font-semibold text-center tracking-tight">
                {isSignUp ? "Create your account" : "Sign in to Tradelog"}
              </h1>
              <p className="text-sm text-[#6E7076] text-center mt-2 mb-7">
                {isSignUp ? "Already have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(isSignUp ? "signin" : "signup");
                    setError("");
                  }}
                  className="text-[#4ADE80] hover:underline font-medium"
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
                    type="email"
                    autoComplete="email"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E7076] hover:text-[#C9CBD1] p-1"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {!isSignUp && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-[#6E7076] hover:text-[#4ADE80] transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/25 rounded-lg px-3 py-2.5 leading-relaxed">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 rounded-xl bg-[#4ADE80] hover:bg-[#3ECF74] disabled:opacity-50 disabled:cursor-not-allowed text-[#08130C] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {isSignUp ? "Create account" : "Sign in"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-[#33363B]">
        tradelog · {new Date().getFullYear()}
      </p>
    </div>
  );
}