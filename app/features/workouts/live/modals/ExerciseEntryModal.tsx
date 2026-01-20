import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import type { LiveWorkoutDraft, LiveExerciseDraft } from "../state/types";
import { getActiveExercise, hasSetData } from "../state/selectors";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function e1rm(weight: number, reps: number) {
  // Epley
  return weight * (1 + reps / 30);
}

function fmtKg(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}kg`;
}

function fmtDateTime(iso: string) {
  // simple, stable display without extra deps
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}

function computeSessionVolume(ex: LiveExerciseDraft) {
  let total = 0;
  for (const s of ex.sets) {
    if (!hasSetData(ex, s)) continue;
    const reps = s.reps ?? 0;
    const w = s.weight ?? 0;
    total += reps * w;
  }
  return total;
}

function bestSetByE1rm(ex: LiveExerciseDraft) {
  let best: {
    setNumber: number;
    weight: number;
    reps: number;
    est: number;
  } | null = null;

  for (const s of ex.sets) {
    const reps = s.reps ?? null;
    const w = s.weight ?? null;
    if (!reps || !w) continue;
    if (reps <= 0 || w <= 0) continue;

    const est = e1rm(w, reps);
    if (!best || est > best.est)
      best = { setNumber: s.setNumber, weight: w, reps, est };
  }

  return best;
}

function isCardio(ex: LiveExerciseDraft) {
  return (ex.type ?? "").toLowerCase() === "cardio";
}

/**
 * Allow only:
 *  - digits
 *  - one "."
 *  - up to 2 decimal digits
 * Example valid: "", "0", "12", "12.", "12.3", "12.34"
 */
function sanitizeWeightInput(raw: string) {
  // Remove all but digits and dot
  let s = raw.replace(/[^\d.]/g, "");

  // Only one dot
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    const before = s.slice(0, firstDot + 1);
    const after = s.slice(firstDot + 1).replace(/\./g, "");
    s = before + after;
  }

  // Max 2 decimals
  const dot = s.indexOf(".");
  if (dot !== -1) {
    const a = s.slice(0, dot);
    const b = s.slice(dot + 1).slice(0, 2);
    s = `${a}.${b}`;
  }

  // Avoid leading zeros like "00" (keep "0." allowed)
  if (s.length >= 2 && s[0] === "0" && s[1] !== ".") {
    s = String(Number(s)); // "01" -> "1"
    if (s === "NaN") s = "";
  }

  return s;
}

function sanitizeRepsInput(raw: string) {
  const s = raw.replace(/[^\d]/g, "");
  if (!s) return "";
  const n = clampInt(Number(s), 0, 300);
  return String(n);
}

function pickLastSessionSet(ex: LiveExerciseDraft, setNumber: number) {
  const ls = ex.lastSession?.sets ?? [];
  if (!ls.length) return null;

  // Try same setNumber first
  const same = ls.find(
    (x) => x.setNumber === setNumber && (x.dropIndex ?? 0) === 0
  );
  if (same) return same;

  // else last meaningful set
  const type = (ex.type ?? "").toLowerCase();
  const last = [...ls].reverse().find((x) => {
    if (type === "cardio")
      return (x.distance ?? 0) > 0 || (x.timeSeconds ?? 0) > 0;
    return (x.reps ?? 0) > 0 || (x.weight ?? 0) > 0;
  });

  return last ?? null;
}

function est1rm(weight: number | null, reps: number | null) {
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;
  // Epley
  return weight * (1 + reps / 30);
}

function scoreStrengthSet(s: { weight: number | null; reps: number | null }) {
  return est1rm(s.weight, s.reps) ?? -1;
}

function pickBestStrengthSource(args: {
  // current workout
  prevSet: { weight: number | null; reps: number | null } | null;
  // history
  lastSet: { weight: number | null; reps: number | null } | null;
}) {
  const prevScore = args.prevSet ? scoreStrengthSet(args.prevSet) : -1;
  const lastScore = args.lastSet ? scoreStrengthSet(args.lastSet) : -1;

  if (prevScore < 0 && lastScore < 0) return null;
  return prevScore >= lastScore ? args.prevSet : args.lastSet;
}

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

  onToggleDropset?: (exerciseIndex: number, value: boolean) => void;
  onJumpToExercise?: (exerciseIndex: number) => void;

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
}) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { index, exercise } = useMemo(
    () => getActiveExercise(props.draft),
    [props.draft]
  );
  const setNumber = props.draft.ui.activeSetNumber;
  const set = exercise?.sets.find((s) => s.setNumber === setNumber) ?? null;

  const cardio = exercise ? isCardio(exercise) : false;

  // ---- local input strings so "." works consistently ----
  const [weightText, setWeightText] = useState("");
  const [repsText, setRepsText] = useState("");

  const weightRef = useRef<TextInput | null>(null);
  const repsRef = useRef<TextInput | null>(null);

  // keep text in sync when you change sets/exercises
  useEffect(() => {
    if (!exercise || !set) return;
    setWeightText(set.weight != null ? String(set.weight) : "");
    setRepsText(set.reps != null ? String(set.reps) : "");
  }, [exercise?.exerciseId, setNumber, set?.weight, set?.reps]);

  const sessionVolume = useMemo(() => {
    if (!exercise || cardio) return 0;
    return computeSessionVolume(exercise);
  }, [exercise, cardio]);

  const bestNow = useMemo(() => {
    if (!exercise || cardio) return null;
    return bestSetByE1rm(exercise);
  }, [exercise, cardio]);

  const prDelta = useMemo(() => {
    if (!exercise || cardio) return null;
    if (!bestNow) return null;
    if (!exercise.bestE1rm) return null;
    return bestNow.est - exercise.bestE1rm;
  }, [exercise, cardio, bestNow]);

  if (!exercise || !set) return null;

  const isDropset = Boolean(exercise.prescription?.isDropset);
  const supersetGroup = exercise.prescription?.supersetGroup ?? null;

  const supersetGroupExercises = useMemo(() => {
    if (!supersetGroup) return [];
    return props.draft.exercises
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.prescription?.supersetGroup === supersetGroup)
      .sort(
        (a, b) =>
          (a.e.prescription?.supersetIndex ?? 0) -
          (b.e.prescription?.supersetIndex ?? 0)
      );
  }, [props.draft.exercises, supersetGroup]);

  const supersetPos = useMemo(() => {
    if (!supersetGroupExercises.length) return null;
    const idxInGroup = supersetGroupExercises.findIndex((x) => x.i === index);
    if (idxInGroup < 0) return null;
    return idxInGroup; // 0-based
  }, [supersetGroupExercises, index]);

  function supersetLetterForGroup(group: string) {
    const groups = Array.from(
      new Set(
        props.draft.exercises
          .map((e) => e.prescription?.supersetGroup)
          .filter((g): g is string => !!g && g.trim().length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));
    const at = groups.indexOf(group);
    const letter = String.fromCharCode(
      "A".charCodeAt(0) + Math.max(0, at % 26)
    );
    return letter;
  }

  const baseSetCount = useMemo(() => {
    return exercise.sets.filter((s) => (s.dropIndex ?? 0) === 0).length;
  }, [exercise.sets]);

  const lastIsCompleteButton = useMemo(() => {
    return setNumber >= baseSetCount;
  }, [setNumber, baseSetCount]);

  // ---- commit helpers ----
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

  // step buttons use numeric values but write through text to keep UI consistent
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

  function useLastSet() {
    const ls = pickLastSessionSet(exercise, setNumber);
    if (!ls) return;

    if (!cardio) {
      if (ls.weight != null) commitWeightText(String(ls.weight));
      if (ls.reps != null) commitRepsText(String(ls.reps));
    } else {
      // cardio future: distance/timeSeconds
      if (ls.distance != null) {
        props.onUpdateSetValue({
          exerciseIndex: index,
          setNumber,
          field: "distance",
          value: ls.distance,
        });
      }
      if (ls.timeSeconds != null) {
        props.onUpdateSetValue({
          exerciseIndex: index,
          setNumber,
          field: "timeSeconds",
          value: ls.timeSeconds,
        });
      }
    }
  }

  useEffect(() => {
    if (!props.visible) return;
    if (!exercise || !set) return;

    // only autofill if this set is empty
    if (hasSetData(exercise, set)) return;

    // ---------- CARDIO: prefer previous set, else history ----------
    if (cardio) {
      const prev =
        exercise.sets.find((s) => s.setNumber === setNumber - 1) ?? null;
      const hist = pickLastSessionSet(exercise, setNumber);

      const src = prev && hasSetData(exercise, prev) ? prev : hist;
      if (!src) return;

      if (src.distance != null) {
        props.onUpdateSetValue({
          exerciseIndex: index,
          setNumber,
          field: "distance",
          value: src.distance,
        });
      }
      if (src.timeSeconds != null) {
        props.onUpdateSetValue({
          exerciseIndex: index,
          setNumber,
          field: "timeSeconds",
          value: src.timeSeconds,
        });
      }
      return;
    }

    // ---------- STRENGTH: pick source by higher e1RM ----------
    const prev =
      exercise.sets.find((s) => s.setNumber === setNumber - 1) ?? null;
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

  const sheetRadius = 26;

  const lastSessionSets = exercise.lastSession?.sets ?? [];
  const lastCompletedAt = exercise.lastSession?.completedAt ?? null;

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop (tap closes + dismiss keyboard) */}
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            props.onClose();
          }}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
        />

        {/* Sheet */}
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
            paddingBottom: insets.bottom + 14,
            paddingTop: 10,
            overflow: "hidden",
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingBottom: 10 }}>
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

          {/* Header row */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 8,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                props.onClose();
              }}
              hitSlop={12}
              style={{ width: 70 }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: typography.fontFamily.semibold,
                }}
              >
                Close
              </Text>
            </Pressable>

            <View style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontFamily: typography.fontFamily.bold,
                  fontSize: typography.size.h3,
                  color: colors.text,
                  letterSpacing: -0.2,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {exercise.name}
              </Text>

              <Text
                style={{
                  color: colors.textMuted,
                  marginTop: 3,
                  fontSize: typography.size.sub,
                }}
              >
                Set {setNumber} of {baseSetCount}
              </Text>
            </View>

            <Pressable
              onPress={props.onSwapExercise}
              hitSlop={12}
              style={{ width: 70, alignItems: "flex-end" }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: typography.fontFamily.semibold,
                }}
              >
                Swap
              </Text>
            </Pressable>
          </View>

          {!!supersetGroup && supersetGroupExercises.length >= 2 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface ?? colors.bg,
                  borderRadius: 18,
                  padding: 6,
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                {supersetGroupExercises.slice(0, 3).map(({ e, i }, k) => {
                  const letter = supersetLetterForGroup(supersetGroup);
                  const tag = `${letter}${k + 1}`;
                  const active = i === index;

                  return (
                    <Pressable
                      key={`${i}`}
                      onPress={() => props.onJumpToExercise?.(i)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 14,
                        backgroundColor: active
                          ? colors.primary
                          : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: active ? "#fff" : colors.textMuted,
                          fontFamily: typography.fontFamily.semibold,
                          fontSize: 13,
                        }}
                        numberOfLines={1}
                      >
                        {tag} {e.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Technique cues moved ABOVE stats */}
          {!!exercise.instructions && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 6,
                paddingBottom: 10,
              }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: typography.size.sub,
                  marginBottom: 6,
                }}
              >
                Technique cues
              </Text>
              <Text style={{ color: colors.text, lineHeight: 20 }}>
                {exercise.instructions}
              </Text>
            </View>
          )}

          // dropset toggle
          {eligibleDropset && (
            <Pressable
              onPress={() => {
                if (!dropMode) {
                  props.onInitDropSetForSet?.({ exerciseIndex: index, setNumber });
                } else {
                  props.onClearDropSetForSet?.({ exerciseIndex: index, setNumber });
                }
              }}
              style={{
                marginTop: 10,
                marginHorizontal: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface ?? colors.bg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.semibold,
                    fontSize: 14,
                  }}
                >
                  Dropset
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    marginTop: 2,
                    fontSize: typography.size.sub,
                  }}
                >
                  Perform reps to failure, reduce weight, repeat immediately.
                </Text>
              </View>

              <View
                style={{
                  width: 46,
                  height: 28,
                  borderRadius: 999,
                  padding: 3,
                  backgroundColor: dropMode ? colors.primary : colors.border,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    alignSelf: dropMode ? "flex-end" : "flex-start",
                  }}
                />
              </View>
            </Pressable>
          )}


          {/* Stats cards */}
          {!cardio && (
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                paddingHorizontal: 16,
                paddingTop: 6,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface ?? colors.bg,
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: typography.size.sub,
                  }}
                >
                  Session Vol
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 26,
                    color: colors.text,
                  }}
                >
                  {Math.round(sessionVolume)} kg
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface ?? colors.bg,
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: typography.size.sub,
                  }}
                >
                  Best PR
                </Text>

                <Text
                  style={{
                    marginTop: 8,
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 18,
                    color: colors.text,
                  }}
                  numberOfLines={1}
                >
                  {bestNow ? `${fmtKg(bestNow.weight)} × ${bestNow.reps}` : "—"}
                </Text>

                <Text
                  style={{
                    color: colors.textMuted,
                    marginTop: 6,
                    fontSize: typography.size.sub,
                  }}
                >
                  {exercise.bestE1rm
                    ? prDelta != null
                      ? prDelta > 0
                        ? `+${Math.round(prDelta)}kg to est 1RM`
                        : `vs best`
                      : `vs best`
                    : "no history"}
                </Text>
              </View>
            </View>
          )}

          {/* History (from existing RPC: lastSession) */}
          {!cardio && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                alignItems: "center", // ✅ center children horizontally
              }}
            >
              {/* Header line */}
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: typography.size.sub,
                  textAlign: "center", // ✅ center text
                }}
              >
                Last session
                {lastCompletedAt ? ` • ${fmtDateTime(lastCompletedAt)}` : ""}
              </Text>

              {/* Sets */}
              {lastSessionSets.length > 0 ? (
                <View
                  style={{
                    marginTop: 10,
                    gap: 6,
                    alignItems: "center", // ✅ center list items
                  }}
                >
                  {lastSessionSets
                    .filter((s) => (s.dropIndex ?? 0) === 0)
                    .slice(0, 6)
                    .map((s) => {
                      const r = s.reps ?? null;
                      const w = s.weight ?? null;

                      const label =
                        r != null && w != null
                          ? `${r} reps × ${fmtKg(w)}`
                          : r != null
                          ? `${r} reps`
                          : w != null
                          ? `${fmtKg(w)}`
                          : "—";

                      return (
                        <Text
                          key={`${s.setNumber}-${s.dropIndex}`}
                          style={{
                            color: colors.text,
                            textAlign: "center", // ✅ center each line
                            fontFamily: typography.fontFamily.medium,
                            fontSize: typography.size.body,
                          }}
                        >
                          {s.setNumber}. {label}
                        </Text>
                      );
                    })}
                </View>
              ) : (
                <Text
                  style={{
                    color: colors.textMuted,
                    marginTop: 8,
                    textAlign: "center", // ✅ centered empty state
                  }}
                >
                  No history yet for this exercise.
                </Text>
              )}
            </View>
          )}

          {/* Inputs */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {cardio ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 20,
                  padding: 14,
                  backgroundColor: colors.surface ?? colors.bg,
                }}
              >
                <Text style={{ color: colors.textMuted }}>
                  Cardio input coming next
                </Text>
              </View>
            ) : (
              <>
                {/* Weight */}
                <Text
                  style={{
                    color: colors.textMuted,
                    marginBottom: 8,
                    fontSize: typography.size.sub,
                  }}
                >
                  Weight (kg)
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 22,
                    backgroundColor: colors.surface ?? colors.bg,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => stepWeight(-2.5)}
                    hitSlop={10}
                    style={{
                      width: 70,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        color: colors.text,
                        fontFamily: typography.fontFamily.bold,
                      }}
                    >
                      −
                    </Text>
                  </Pressable>

                  <View
                    style={{
                      flex: 1,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TextInput
                      ref={weightRef}
                      value={weightText}
                      onChangeText={commitWeightText}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      // IMPORTANT: use "default" so "." always exists, we sanitize ourselves
                      keyboardType={
                        Platform.OS === "ios" ? "default" : "numeric"
                      }
                      inputMode="decimal"
                      style={{
                        fontFamily: typography.fontFamily.bold,
                        fontSize: 34,
                        color: colors.text,
                        textAlign: "center",
                        width: "100%",
                        paddingVertical: 0,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.textMuted,
                        marginTop: -4,
                        fontSize: typography.size.sub,
                      }}
                    >
                      kilograms
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => stepWeight(+2.5)}
                    hitSlop={10}
                    style={{
                      width: 70,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        color: colors.text,
                        fontFamily: typography.fontFamily.bold,
                      }}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>

                {/* Reps */}
                <Text
                  style={{
                    color: colors.textMuted,
                    marginBottom: 8,
                    marginTop: 14,
                    fontSize: typography.size.sub,
                  }}
                >
                  Reps
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 22,
                    backgroundColor: colors.surface ?? colors.bg,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => stepReps(-1)}
                    hitSlop={10}
                    style={{
                      width: 70,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        color: colors.text,
                        fontFamily: typography.fontFamily.bold,
                      }}
                    >
                      −
                    </Text>
                  </Pressable>

                  <View
                    style={{
                      flex: 1,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TextInput
                      ref={repsRef}
                      value={repsText}
                      onChangeText={commitRepsText}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontFamily: typography.fontFamily.bold,
                        fontSize: 34,
                        color: colors.text,
                        textAlign: "center",
                        width: "100%",
                        paddingVertical: 0,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.textMuted,
                        marginTop: -4,
                        fontSize: typography.size.sub,
                      }}
                    >
                      repetitions
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => stepReps(+1)}
                    hitSlop={10}
                    style={{
                      width: 70,
                      height: 64,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        color: colors.text,
                        fontFamily: typography.fontFamily.bold,
                      }}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Bottom actions */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginTop: 18,
              }}
            >
              <Pressable
                onPress={props.onPrevSet}
                disabled={setNumber <= 1}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: setNumber <= 1 ? 0.35 : 1,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 22,
                    fontFamily: typography.fontFamily.bold,
                  }}
                >
                  ←
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  if (lastIsCompleteButton) {
                    // If you want: validate that some data exists before closing:
                    // if (!hasSetData(exercise, set)) return;
                    props.onClose();
                  } else {
                    props.onNextSet();
                  }
                }}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: lastIsCompleteButton
                    ? colors.success ?? "#22c55e"
                    : colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 18,
                  }}
                >
                  {lastIsCompleteButton ? "Complete" : "Next Set →"}
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 10,
                marginTop: 14,
              }}
            >
              <Pressable
                onPress={() => props.onRemoveSet(index)}
                disabled={exercise.sets.length <= 1}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: exercise.sets.length <= 1 ? 0.35 : 1,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.semibold,
                  }}
                >
                  − Remove set
                </Text>
              </Pressable>

              <Pressable
                onPress={() => props.onAddSet(index)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.semibold,
                  }}
                >
                  + Add set
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
