// lib/useAuth.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type UserRole = "user" | "pt" | "admin";

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole | null; // will be "user" by default once you add the column
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", userId)
      .single();

    if (error) {
      // If profile row doesn't exist yet, don't hard-crash the app.
      // You can choose to handle this by auto-creating profile rows on signup.
      setProfile(null);
      return;
    }

    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const sess = data.session ?? null;

      if (!mounted) return;

      setSession(sess);

      if (sess?.user?.id) {
        await fetchProfile(sess.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (!mounted) return;

        setSession(sess ?? null);

        if (sess?.user?.id) {
          await fetchProfile(sess.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return { session, profile, loading };
}
