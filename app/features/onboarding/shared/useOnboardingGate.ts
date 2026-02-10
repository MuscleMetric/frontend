import { useEffect, useState } from "react";
import type { OnboardingGateDecision } from "./types";
import { fetchOnboardingStatus } from "./rpc";

/**
 * Minimal gate — you’ll wire real triggers later:
 * - Stage2 eligible when workouts_total >= 1
 * - Stage3 eligible when workouts_total >= 5
 */
export function useOnboardingGate() {
  const [decision, setDecision] = useState<OnboardingGateDecision>({
    should_show: false,
    stage: null,
    reason: "unknown",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const status = await fetchOnboardingStatus();

      if (cancelled) return;

      if (!status) {
        setDecision({ should_show: false, stage: null, reason: "unknown" });
        setLoading(false);
        return;
      }

      // Stage3 > Stage2 priority
      const stage3Done = !!status.stage3_completed_at || !!status.stage3_dismissed_at;
      const stage2Done = !!status.stage2_completed_at || !!status.stage2_dismissed_at;

      if (!stage3Done && status.workouts_total >= 5) {
        setDecision({ should_show: true, stage: "stage3_five_workouts", reason: "eligible" });
      } else if (!stage2Done && status.workouts_total >= 1) {
        setDecision({ should_show: true, stage: "stage2_first_workout", reason: "eligible" });
      } else {
        setDecision({ should_show: false, stage: null, reason: "already_completed" });
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, decision };
}
