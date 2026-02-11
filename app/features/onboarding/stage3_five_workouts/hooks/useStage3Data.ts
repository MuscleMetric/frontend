// app/onboarding/stage3_five_workouts/hooks/useStage3Data.ts

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Stage3DataState,
  Stage3Payload,
  Stage3UiStrings,
  Stage3RpcPoint,
} from "../types";

function safeNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtInt(n: number | null) {
  if (n == null) return "—";
  return String(Math.round(n));
}

function fmtCommaInt(n: number | null) {
  if (n == null) return "—";
  const v = Math.round(n);
  return v.toLocaleString();
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

function fmtWeight(n: number | null, unit: string) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const txt = v % 1 === 0 ? String(v) : v.toFixed(1);
  return `${txt} ${unit}`;
}

function firstName(full: string | null) {
  if (!full) return null;
  const t = full.trim();
  if (!t) return null;
  return t.split(" ")[0];
}

export function useStage3Data(): Stage3DataState {
  const [state, setState] = useState<Stage3DataState>({
    loading: true,
    error: null,
    payload: null,
    ui: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState((s) => ({ ...s, loading: true, error: null }));

        const res = await supabase
          .rpc("get_onboarding_stage3_five_workouts_payload_v1")
          .single();

        if (cancelled) return;

        if (res.error || !res.data) {
          setState({
            loading: false,
            error: res.error?.message ?? "Failed to load stage 3 payload",
            payload: null,
            ui: null,
          });
          return;
        }

        const p = res.data as Stage3Payload;

        console.log("[stage3] rpc payload:", res.data);

        const unit = (p.unit_weight ?? "kg") as Stage3UiStrings["unitWeight"];
        const name = firstName(p.user_name) ?? "there";

        const workoutsTotal = safeNum(p.workouts_completed_total) ?? 0;

        const windowDays = safeNum(p.window_days);
        const windowLabel =
          windowDays != null
            ? `in ${Math.max(1, Math.round(windowDays))} days`
            : "recently";

        // hero stat: prefer strength %, else volume
        const strengthPct = safeNum(p.strength_change_pct);
        const volume = safeNum(p.total_volume);

        const heroStatKicker =
          strengthPct != null ? "EST. STRENGTH" : "TOTAL VOLUME";
        const heroStatLabel =
          strengthPct != null ? fmtPct(strengthPct) : fmtCommaInt(volume);
        const heroStatSub =
          strengthPct != null && p.spotlight_exercise_name
            ? `${p.spotlight_exercise_name} 1RM estimate`
            : "Total volume moved so far";

        // spotlight
        const spotlightTitle = p.spotlight_exercise_name ?? "Your lift";
        const spotlightValueLabel = fmtWeight(
          safeNum(p.spotlight_current_1rm),
          unit
        );
        const spotlightChangeLabel = fmtPct(
          safeNum(p.spotlight_change_pct) ?? strengthPct
        );

        const seriesRaw = (p.spotlight_series ?? []) as any[];
        const spotlightSeries: Stage3RpcPoint[] = Array.isArray(seriesRaw)
          ? seriesRaw
              .map((pt) => ({
                x: Number(pt?.x ?? 0),
                y: Number(pt?.y ?? 0),
                label: pt?.label ?? null,
              }))
              .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))
          : [];

        // weekly
        const goal = safeNum(p.weekly_goal_target) ?? 3;
        const done = safeNum(p.weekly_completed) ?? 0;
        const weeklyPct = goal > 0 ? Math.max(0, Math.min(1, done / goal)) : 0;
        const weeklyProgressLabel = `${Math.min(done, 99)} / ${Math.min(
          goal,
          99
        )}`;

        // streak
        const streakWeeks = safeNum(p.streak_weeks) ?? 0;
        const streakLabel =
          streakWeeks <= 0
            ? "Starting your streak"
            : `${streakWeeks} week${streakWeeks === 1 ? "" : "s"} in a row`;

        const consChg = safeNum(p.consistency_change_pct);
        const consistencyChangeLabel =
          consChg == null ? null : `${fmtPct(consChg)} vs last month`;

        // recommendation
        const recoTitle = p.recommended_split_label ?? "Recommended split";
        const recoSubtitle = `${
          safeNum(p.recommended_days_per_week) ?? goal
        } days / week`;
        const recoSchedule = Array.isArray(p.recommended_schedule)
          ? p.recommended_schedule
          : [];

        // milestone preview
        const milestoneTitle = p.milestone_exercise_name ?? spotlightTitle;
        const milestoneProgressLabel =
          p.milestone_progress_pct != null
            ? `${Math.round(Number(p.milestone_progress_pct))}%`
            : "—";
        const milestoneCurrentLabel = fmtWeight(
          safeNum(p.milestone_current_value),
          unit
        );
        const milestoneTargetLabel = fmtWeight(
          safeNum(p.milestone_target_value),
          unit
        );
        const milestoneStatusLabel = p.milestone_on_track
          ? "ON TRACK"
          : "BUILDING";

        const ui: Stage3UiStrings = {
          greetingName: name,
          unitWeight: unit,

          workoutsTotalLabel: fmtInt(workoutsTotal),
          windowLabel,

          heroStatLabel,
          heroStatKicker,
          heroStatSub,

          spotlightTitle,
          spotlightValueLabel,
          spotlightChangeLabel,
          spotlightSeries,

          weeklyProgressLabel,
          weeklyPct,

          streakLabel,
          consistencyChangeLabel,

          recoTitle,
          recoSubtitle,
          recoSchedule,

          milestoneTitle,
          milestoneProgressLabel,
          milestoneCurrentLabel,
          milestoneTargetLabel,
          milestoneStatusLabel,
        };

        setState({
          loading: false,
          error: null,
          payload: p,
          ui,
        });
      } catch (e: any) {
        if (cancelled) return;
        setState({
          loading: false,
          error: e?.message ?? "Failed to load stage 3 payload",
          payload: null,
          ui: null,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => state, [state]);
}
