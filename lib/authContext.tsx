// lib/authContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = "user" | "pt" | "admin";

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole | null;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // optional helpers if you want them later:
  userId: string | null;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // prevent stale profile writes if multiple fetches overlap
  const profileReqId = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    const reqId = ++profileReqId.current;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", userId)
      .single();

    if (reqId !== profileReqId.current) return;

    if (error) {
      setProfile(null);
      return;
    }
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        const sess = error ? null : data.session ?? null;
        setSession(sess);
        setLoading(false); // ✅ don't block on profile

        if (sess?.user?.id) fetchProfile(sess.user.id);
        else setProfile(null);
      } catch {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        if (!mounted) return;

        setSession(sess ?? null);
        setLoading(false);

        if (sess?.user?.id) fetchProfile(sess.user.id);
        else setProfile(null);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthValue>(() => {
    const userId = session?.user?.id ?? null;
    return { session, profile, loading, userId };
  }, [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
