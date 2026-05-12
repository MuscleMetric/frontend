// app/(features)/goals/hooks/usePlanGoals.ts
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";

export type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

export type GoalMetric = "weight" | "reps" | "distance" | "time";

export type GoalRow = {
  id: string;

  type: "exercise_weight" | "exercise_reps" | "distance" | "time";
  target_number: number;
  unit: string | null;
  deadline: string | null;
  is_active: boolean | null;
  notes: string | null;
  created_at?: string | null;

  metrics: GoalMetric[];
  goal_summary: string | null;

  start_weight: number | null;
  start_reps: number | null;
  start_distance: number | null;
  start_time_seconds: number | null;

  target_weight: number | null;
  target_reps: number | null;
  target_distance: number | null;
  target_time_seconds: number | null;

  exercises: { id: string; name: string | null } | null;
};

function normaliseMetrics(raw: any, legacyType: GoalRow["type"]): GoalMetric[] {
  if (Array.isArray(raw)) {
    const clean = raw.filter((m): m is GoalMetric =>
      ["weight", "reps", "distance", "time"].includes(String(m)),
    );

    if (clean.length > 0) return clean;
  }

  switch (legacyType) {
    case "exercise_weight":
      return ["weight"];
    case "exercise_reps":
      return ["reps"];
    case "distance":
      return ["distance"];
    case "time":
      return ["time"];
    default:
      return [];
  }
}

function toNumberOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseLegacyStart(notes?: string | null): number | null {
  if (!notes) return null;

  try {
    const o = JSON.parse(notes);
    if (typeof o?.start === "number") return o.start;
  } catch {}

  return null;
}

function legacyStartPatch(
  legacyType: GoalRow["type"],
  notes?: string | null,
): Partial<GoalRow> {
  const start = parseLegacyStart(notes);
  if (start == null) return {};

  switch (legacyType) {
    case "exercise_weight":
      return { start_weight: start };
    case "exercise_reps":
      return { start_reps: start };
    case "distance":
      return { start_distance: start };
    case "time":
      return { start_time_seconds: start };
    default:
      return {};
  }
}

function legacyTargetPatch(
  legacyType: GoalRow["type"],
  targetNumber: number,
): Partial<GoalRow> {
  switch (legacyType) {
    case "exercise_weight":
      return { target_weight: targetNumber };
    case "exercise_reps":
      return { target_reps: targetNumber };
    case "distance":
      return { target_distance: targetNumber };
    case "time":
      return { target_time_seconds: targetNumber };
    default:
      return {};
  }
}

export function usePlanGoals(userId?: string | null) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setPlan(null);
      setGoals([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

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

        if (!activePlan?.id) {
          if (!cancelled) setGoals([]);
          return;
        }

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
            metrics,
            goal_summary,
            start_weight,
            start_reps,
            start_distance,
            start_time_seconds,
            target_weight,
            target_reps,
            target_distance,
            target_time_seconds,
            exercises ( id, name )
          `,
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
            ex = first ? { id: String(first.id), name: first.name ?? null } : null;
          } else if (r.exercises) {
            ex = {
              id: String(r.exercises.id),
              name: r.exercises.name ?? null,
            };
          }

          const legacyType = r.type as GoalRow["type"];
          const targetNumber = Number(r.target_number ?? 0);

          const base: GoalRow = {
            id: String(r.id),
            type: legacyType,
            target_number: targetNumber,
            unit: r.unit ?? null,
            deadline: r.deadline ?? null,
            is_active: Boolean(r.is_active),
            notes: r.notes ?? null,
            created_at: r.created_at ?? null,

            metrics: normaliseMetrics(r.metrics, legacyType),
            goal_summary: r.goal_summary ?? null,

            start_weight: toNumberOrNull(r.start_weight),
            start_reps: toNumberOrNull(r.start_reps),
            start_distance: toNumberOrNull(r.start_distance),
            start_time_seconds: toNumberOrNull(r.start_time_seconds),

            target_weight: toNumberOrNull(r.target_weight),
            target_reps: toNumberOrNull(r.target_reps),
            target_distance: toNumberOrNull(r.target_distance),
            target_time_seconds: toNumberOrNull(r.target_time_seconds),

            exercises: ex,
          };

          return {
            ...base,
            ...legacyStartPatch(legacyType, base.notes),
            ...legacyTargetPatch(legacyType, targetNumber),
          };
        });

        if (!cancelled) setGoals(rows);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load plan goals.");
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