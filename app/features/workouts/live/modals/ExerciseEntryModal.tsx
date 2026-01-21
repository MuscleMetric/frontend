// live/modals/ExerciseEntryModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import type { LiveWorkoutDraft } from "../state/types";
import { getActiveExercise, hasSetData } from "../state/selectors";

import { ModalHeaderRow } from "./sections/ModalHeaderRow";
import { SupersetSwitcher } from "./sections/SupersetSwitcher";
import { TechniqueCues } from "./sections/TechniqueCues";
import { DropsetToggleRow } from "./sections/DropsetToggleRow";
import { DropsetEditor } from "./sections/DropsetEditor";
import { StrengthStatsCards } from "./sections/StrengthStatsCards";
import { LastSessionSummary } from "./sections/LastSessionSummary";
import { StrengthInputs } from "./sections/StrengthInputs";
import { CardioInputs } from "./sections/CardioInputs";
import { BottomActions } from "./sections/BottomActions";

import * as M from "../state/mutators";
import {
  sanitizeRepsInput,
  sanitizeWeightInput,
  clampInt,
} from "./helpers/inputSanitizers";
import {
  computeSessionVolume,
  bestSetByE1rm,
  pickBestStrengthSource,
} from "./helpers/strengthMath";
import { pickLastSessionSet, isCardio } from "./helpers/historyPickers";
import {
  getBaseSetCount,
  getDropRowsForSetNumber,
  dropModeForSet,
} from "./helpers/dropset";
import { parseNullableNumber } from "./helpers/cardio";

export function ExerciseEntryModal(props: {
  visible: boolean;
  onClose: () => void;
  draft: LiveWorkoutDraft;

  onUpdateSetValue: (args: {
    exerciseIndex: number;
    setNumber: number;
    field: "reps" | "weight" | "timeSeconds" | "distance";
    value: number | null;
  }) => void;

  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number) => void;

  onPrevSet: () => void;
  onNextSet: () => void;

  onSwapExercise?: () => void;
  onJumpToExercise?: (exerciseIndex: number) => void;

  onToggleDropset?: (exerciseIndex: number, value: boolean) => void;

  // Dropset mutations (these should call state/mutators)
  onInitDropSetForSet?: (args: {
    exerciseIndex: number;
    setNumber: number;
  }) => void;
  onClearDropSetForSet?: (args: {
    exerciseIndex: number;
    setNumber: number;
  }) => void;
  onAddDrop?: (args: { exerciseIndex: number; setNumber: number }) => void;
  onUpdateDropSetValue?: (args: {
    exerciseIndex: number;
    setNumber: number;
    dropIndex: number;
    field: "reps" | "weight";
    value: number | null;
  }) => void;
  onRemoveDrop?: (args: { exerciseIndex: number; setNumber: number }) => void;
}) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { index, exercise } = useMemo(
    () => getActiveExercise(props.draft),
    [props.draft]
  );
  const setNumber = props.draft.ui.activeSetNumber;
  const set =
    exercise?.sets.find(
      (s) => s.setNumber === setNumber && (s.dropIndex ?? 0) === 0
    ) ?? null;

  const cardio = exercise ? isCardio(exercise) : false;
  if (!exercise || !set) return null;

  const baseSetCount = useMemo(
    () => getBaseSetCount(exercise),
    [exercise.sets]
  );
  const lastIsCompleteButton = useMemo(() => {
    // If there is a next destination (superset-aware), we are NOT complete
    const next = M.peekNextSupersetAware(props.draft);
    return !next;
  }, [props.draft]);

  // ----- text state (strength) -----
  const [weightText, setWeightText] = useState("");
  const [repsText, setRepsText] = useState("");
  const weightRef = useRef<TextInput | null>(null);
  const repsRef = useRef<TextInput | null>(null);

  // ----- text state (cardio) -----
  const [distanceText, setDistanceText] = useState("");
  const [timeText, setTimeText] = useState("");

  // sync inputs on set change
  useEffect(() => {
    if (!exercise) return;
    if (!cardio) {
      setWeightText(set.weight != null ? String(set.weight) : "");
      setRepsText(set.reps != null ? String(set.reps) : "");
    } else {
      setDistanceText(set.distance != null ? String(set.distance) : "");
      setTimeText(set.timeSeconds != null ? String(set.timeSeconds) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.exerciseId, setNumber]);

  // --- derived ---
  const sessionVolume = useMemo(() => {
    if (cardio) return 0;
    return computeSessionVolume(exercise);
  }, [exercise, cardio]);

  const bestNow = useMemo(() => {
    if (cardio) return null;
    return bestSetByE1rm(exercise);
  }, [exercise, cardio]);

  const prDelta = useMemo(() => {
    if (cardio) return null;
    if (!bestNow) return null;
    if (!exercise.bestE1rm) return null;
    return bestNow.est - exercise.bestE1rm;
  }, [exercise, cardio, bestNow]);

  // --- superset ---
  const supersetGroup = exercise.prescription?.supersetGroup ?? null;

  // --- dropset eligibility + state for THIS set ---
  const eligibleDropset = !cardio && Boolean(exercise.prescription?.isDropset);
  const dropRows = useMemo(() => {
    if (!eligibleDropset) return [];
    return getDropRowsForSetNumber(exercise, setNumber);
  }, [eligibleDropset, exercise.sets, setNumber]);

  const dropMode = eligibleDropset && dropModeForSet(exercise, setNumber);

  const canRemoveDrop = eligibleDropset && dropMode && dropRows.length > 1;

  // ---- commit helpers (strength) ----
  function commitWeightText(t: string) {
    const s = sanitizeWeightInput(t);
    setWeightText(s);

    if (!s || s === "." || s === "0" || s === "0.") {
      props.onUpdateSetValue({
        exerciseIndex: index,
        setNumber,
        field: "weight",
        value: null,
      });
      return;
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return;

    const safe = Math.max(0, Math.round(n * 100) / 100);
    props.onUpdateSetValue({
      exerciseIndex: index,
      setNumber,
      field: "weight",
      value: safe,
    });
  }

  function commitRepsText(t: string) {
    const s = sanitizeRepsInput(t);
    setRepsText(s);

    if (!s || s === "0") {
      props.onUpdateSetValue({
        exerciseIndex: index,
        setNumber,
        field: "reps",
        value: null,
      });
      return;
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return;

    const safe = clampInt(n, 0, 300);
    props.onUpdateSetValue({
      exerciseIndex: index,
      setNumber,
      field: "reps",
      value: safe,
    });
  }

  function stepWeight(delta: number) {
    const cur = Number(weightText || 0) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    commitWeightText(String(next));
  }

  function stepReps(delta: number) {
    const cur = Number(repsText || 0) || 0;
    const next = clampInt(cur + delta, 0, 300);
    commitRepsText(String(next));
  }

  // ---- cardio commits ----
  function commitDistanceText(t: string) {
    setDistanceText(t);
    const n = parseNullableNumber(t);
    props.onUpdateSetValue({
      exerciseIndex: index,
      setNumber,
      field: "distance",
      value: n,
    });
  }

  function commitTimeText(t: string) {
    setTimeText(t);
    const n = t ? Number(t) : null;
    const v =
      n != null && Number.isFinite(n) ? Math.max(0, Math.min(86400, n)) : null;
    props.onUpdateSetValue({
      exerciseIndex: index,
      setNumber,
      field: "timeSeconds",
      value: v,
    });
  }

  // ---- autofill ----
  useEffect(() => {
    if (!props.visible) return;

    // only autofill if empty
    if (hasSetData(exercise, set)) return;

    if (cardio) {
      const prev =
        exercise.sets.find(
          (s) => s.setNumber === setNumber - 1 && (s.dropIndex ?? 0) === 0
        ) ?? null;
      const hist = pickLastSessionSet(exercise, setNumber);
      const src = prev && hasSetData(exercise, prev) ? prev : hist;
      if (!src) return;

      if (src.distance != null) commitDistanceText(String(src.distance));
      if (src.timeSeconds != null) commitTimeText(String(src.timeSeconds));
      return;
    }

    const prev =
      exercise.sets.find(
        (s) => s.setNumber === setNumber - 1 && (s.dropIndex ?? 0) === 0
      ) ?? null;
    const hist = pickLastSessionSet(exercise, setNumber);

    const prevCandidate =
      prev && hasSetData(exercise, prev)
        ? { weight: prev.weight ?? null, reps: prev.reps ?? null }
        : null;

    const histCandidate = hist
      ? { weight: hist.weight ?? null, reps: hist.reps ?? null }
      : null;

    const best = pickBestStrengthSource({
      prevSet: prevCandidate,
      lastSet: histCandidate,
    });
    if (!best) return;

    if (best.weight != null) commitWeightText(String(best.weight));
    if (best.reps != null) commitRepsText(String(best.reps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible, exercise.exerciseId, setNumber]);

  const lastSessionSets = exercise.lastSession?.sets ?? [];
  const lastCompletedAt = exercise.lastSession?.completedAt ?? null;

  const sheetRadius = 26;

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={props.onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Pin everything to the bottom like a proper sheet */}
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {/* Backdrop */}
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              props.onClose();
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.25)",
            }}
          />

          {/* Bottom Sheet */}
          <View
            style={{
              backgroundColor: colors.bg, // ✅ from global theme via useAppTheme -> colors.bg
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
              overflow: "hidden",
              maxHeight: "92%", // ✅ grows to content, scrolls after this
            }}
          >
            {/* Handle */}
            <View
              style={{
                alignItems: "center",
                paddingTop: 10,
                paddingBottom: 10,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 99,
                  backgroundColor: colors.border,
                  opacity: 0.9,
                }}
              />
            </View>

            {/* Content */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: insets.bottom + 14,
              }}
            >
              <ModalHeaderRow
                colors={colors}
                typography={typography}
                title={exercise.name}
                subtitle={`Set ${setNumber} of ${baseSetCount}`}
                onClose={props.onClose}
                // ✅ menu
                canDropset={!cardio}
                dropsetEnabled={Boolean(exercise.prescription?.isDropset)}
                onToggleDropset={() => {
                  // this is the EXERCISE-level flag (not per-set drop rows)
                  props.onToggleDropset?.(
                    index,
                    !Boolean(exercise.prescription?.isDropset)
                  );
                }}
                onSwapExercise={props.onSwapExercise}
              />

              {supersetGroup ? (
                <SupersetSwitcher
                  draft={props.draft}
                  activeExerciseIndex={index}
                  colors={colors}
                  typography={typography}
                  supersetGroup={supersetGroup}
                  onJumpToExercise={(exerciseIndex) => {
                    Keyboard.dismiss();
                    props.onJumpToExercise?.(exerciseIndex);
                  }}
                />
              ) : null}

              <TechniqueCues
                colors={colors}
                typography={typography}
                instructions={exercise.instructions}
              />

              {eligibleDropset ? (
                <DropsetToggleRow
                  colors={colors}
                  typography={typography}
                  enabled={dropMode}
                  onToggle={() => {
                    Keyboard.dismiss();
                    if (!dropMode) {
                      props.onInitDropSetForSet?.({
                        exerciseIndex: index,
                        setNumber,
                      });
                    } else {
                      props.onClearDropSetForSet?.({
                        exerciseIndex: index,
                        setNumber,
                      });
                    }
                  }}
                />
              ) : null}

              {!cardio ? (
                <StrengthStatsCards
                  colors={colors}
                  typography={typography}
                  sessionVolume={sessionVolume}
                  bestNow={
                    bestNow
                      ? { weight: bestNow.weight, reps: bestNow.reps }
                      : null
                  }
                  bestE1rm={exercise.bestE1rm}
                  prDelta={prDelta}
                />
              ) : null}

              {!cardio ? (
                <LastSessionSummary
                  colors={colors}
                  typography={typography}
                  lastCompletedAt={lastCompletedAt}
                  lastSessionSets={lastSessionSets as any}
                />
              ) : null}

              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                {cardio ? (
                  <CardioInputs
                    colors={colors}
                    typography={typography}
                    distanceText={distanceText}
                    timeText={timeText}
                    onChangeDistance={(t) => {
                      commitDistanceText(t);
                    }}
                    onChangeTime={(t) => {
                      commitTimeText(t);
                    }}
                  />
                ) : eligibleDropset && dropMode ? (
                  // ✅ drops replace weight/reps entirely
                  <View />
                ) : (
                  <StrengthInputs
                    colors={colors}
                    typography={typography}
                    weightText={weightText}
                    repsText={repsText}
                    onChangeWeightText={(t) => commitWeightText(t)}
                    onChangeRepsText={(t) => commitRepsText(t)}
                    onStepWeight={(d) => stepWeight(d)}
                    onStepReps={(d) => stepReps(d)}
                    weightRef={weightRef as any}
                    repsRef={repsRef as any}
                  />
                )}

                {/* ✅ Dropset editor lives where Weight/Reps normally would */}
                {eligibleDropset && dropMode ? (
                  <DropsetEditor
                    colors={colors}
                    typography={typography}
                    dropRows={dropRows.map((d) => ({
                      setNumber: d.setNumber,
                      dropIndex: d.dropIndex,
                      reps: d.reps,
                      weight: d.weight,
                    }))}
                    onUpdateDrop={(a) => {
                      props.onUpdateDropSetValue?.({
                        exerciseIndex: index,
                        setNumber,
                        dropIndex: a.dropIndex,
                        field: a.field,
                        value: a.value,
                      });
                    }}
                    onAddDrop={() => {
                      Keyboard.dismiss();
                      props.onAddDrop?.({ exerciseIndex: index, setNumber });
                    }}
                    canRemoveDrop={canRemoveDrop}
                    onRemoveDrop={() => {
                      Keyboard.dismiss();
                      props.onRemoveDrop?.({ exerciseIndex: index, setNumber });
                    }}
                  />
                ) : null}

                <BottomActions
                  colors={colors}
                  typography={typography}
                  canPrev={setNumber > 1}
                  primaryLabel={
                    lastIsCompleteButton ? "Complete" : "Next Set →"
                  }
                  primaryColor={
                    lastIsCompleteButton
                      ? colors.success ?? "#22c55e"
                      : colors.primary
                  }
                  onPrev={() => {
                    Keyboard.dismiss();
                    props.onPrevSet();
                  }}
                  onPrimary={() => {
                    Keyboard.dismiss();
                    if (lastIsCompleteButton) props.onClose();
                    else props.onNextSet();
                  }}
                  canRemoveSet={
                    exercise.sets.filter((s) => (s.dropIndex ?? 0) === 0)
                      .length > 1
                  }
                  onRemoveSet={() => {
                    Keyboard.dismiss();
                    props.onRemoveSet(index);
                  }}
                  onAddSet={() => {
                    Keyboard.dismiss();
                    props.onAddSet(index);
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
