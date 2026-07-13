import { useEffect, useState } from "react";
import { HAS_BACKEND } from "./env";
import { supabase } from "./supabase";

const KEY = "rw_mock_signed_in";

export function useMockAuth() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!HAS_BACKEND || !supabase) {
      setSignedIn(localStorage.getItem(KEY) === "1");
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return {
    signedIn,
    sendMagicLink: async (email: string) => {
      if (!supabase) return;
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/account" },
      });
    },
    signIn: () => {
      if (HAS_BACKEND) return;
      localStorage.setItem(KEY, "1");
      setSignedIn(true);
    },
    signOut: async () => {
      if (HAS_BACKEND && supabase) {
        await supabase.auth.signOut();
        setSignedIn(false);
        return;
      }
      localStorage.removeItem(KEY);
      setSignedIn(false);
    },
    hasBackend: HAS_BACKEND,
  };
}
