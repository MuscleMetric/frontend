// app/(features)/goals/hooks/usePlanGoals.ts
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase";

export type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

export type GoalRow = {
  id: string;
  type: "exercise_weight" | "exercise_reps" | "distance" | "time";
  target_number: number;
  unit: string | null;
  deadline: string | null;
  is_active: boolean | null;
  notes: string | null; // JSON with { start?: number }
  exercises: { id: string; name: string | null } | null;
  created_at?: string | null;
};

export function usePlanGoals(userId?: string | null) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Active plan (else most recent)
        let { data: activePlan, error: apErr } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date, is_completed")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (apErr) throw apErr;

        if (!activePlan) {
          const { data, error } = await supabase
            .from("plans")
            .select("id, title, start_date, end_date, is_completed")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          activePlan = data ?? null;
        }

        if (cancelled) return;
        setPlan(activePlan ?? null);

        // 2) Goals for that plan (if any)
        if (activePlan?.id) {
          const { data: g, error: gErr } = await supabase
            .from("goals")
            .select(
              `
              id,
              type,
              target_number,
              unit,
              deadline,
              is_active,
              notes,
              created_at,
              exercises ( id, name )
            `
            )
            .eq("plan_id", activePlan.id)
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("created_at", { ascending: true });

          if (gErr) throw gErr;

          const rows: GoalRow[] = (g ?? []).map((r: any) => {
            let ex: { id: string; name: string | null } | null = null;
            if (Array.isArray(r.exercises)) {
              const first = r.exercises[0];
              ex = first
                ? { id: String(first.id), name: first.name ?? null }
                : null;
            } else if (r.exercises) {
              ex = {
                id: String(r.exercises.id),
                name: r.exercises.name ?? null,
              };
            }
            return {
              id: String(r.id),
              type: r.type,
              target_number: Number(r.target_number),
              unit: r.unit ?? null,
              deadline: r.deadline ?? null,
              is_active: Boolean(r.is_active),
              notes: r.notes ?? null,
              created_at: r.created_at ?? null,
              exercises: ex,
            };
          });

          if (!cancelled) setGoals(rows);
        } else {
          if (!cancelled) setGoals([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load plan goals.");
        if (!cancelled) {
          setPlan(null);
          setGoals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const planTitle = useMemo(() => plan?.title ?? "Active Plan", [plan?.title]);

  return { loading, error, plan, planTitle, goals };
}
