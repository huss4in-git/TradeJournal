import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// "Remember me" decides where the session lives:
//   localStorage   — survives closing the browser, stays signed in
//   sessionStorage — cleared when the tab closes, so a shared or public
//                    machine doesn't keep you logged in
//
// The flag itself always lives in localStorage, since it has to be readable
// before we know which store the session is in.
const REMEMBER_KEY = "tradelog:remember";

export const setRemember = (value) => {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? "1" : "0");
  } catch {
    // Private browsing can throw; defaults to remembering.
  }
};

export const getRemember = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
};

// Reads from whichever store holds the session, writes to the chosen one.
const storage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (getRemember()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch {
      // Nothing useful to do if storage is unavailable.
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});