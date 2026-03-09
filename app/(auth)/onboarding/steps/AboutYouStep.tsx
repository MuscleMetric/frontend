import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import type { ErrorMap, Gender, OnboardingDraft } from "../types";

import { Stepper } from "../components/Stepper";
import { Field } from "../components/Field";
import { SegmentRow } from "../components/SegmentRow";
import { PrimaryCTA } from "../components/PrimaryCTA";

type UsernameCheckRow = {
  normalized: string;
  is_valid: boolean;
  is_available: boolean;
  reason: string | null;
};

type UsernameStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; normalized: string }
  | { kind: "taken"; normalized: string }
  | { kind: "invalid"; normalized: string; reason: string | null }
  | { kind: "error"; message: string };

function normalizeUsernameInput(raw: string) {
  // Keep only a-z 0-9 _ , lowercased, trimmed, no spaces
  const v = (raw ?? "").toLowerCase().trim();
  // remove spaces entirely, then strip invalid chars
  return v.replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "");
}

function usernameHintFromReason(reason: string | null) {
  switch (reason) {
    case "too_short":
      return "Username must be at least 3 characters";
    case "too_long":
      return "Username must be 13 characters or less";
    case "no_spaces":
      return "No spaces allowed";
    case "invalid_chars":
      return "Only letters, numbers, and underscores";
    case "taken":
      return "That username is taken";
    default:
      return null;
  }
}

export function AboutYouStep({
  draft,
  errors,
  onChange,
  onOpenDob,
  onNext,
  stepLabel = "STEP 1 OF 4",
  progress = 0.25,
}: {
  draft: OnboardingDraft;
  errors: ErrorMap;
  onChange: <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K]
  ) => void;
  onOpenDob: () => void;
  onNext: () => void;
  stepLabel?: string;
  progress?: number; // 0..1
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dobLabel = draft.dob ? formatDob(draft.dob) : "Tap to select";

  const [uStatus, setUStatus] = useState<UsernameStatus>({ kind: "idle" });
  const lastChecked = useRef<string>("");

  const checkUsername = useCallback(
    async (username: string) => {
      const norm = normalizeUsernameInput(username);

      // if empty, just reset UI state (validation will catch it if required)
      if (!norm) {
        setUStatus({ kind: "idle" });
        lastChecked.current = "";
        return;
      }

      // avoid re-checking same value
      if (lastChecked.current === norm) return;

      setUStatus({ kind: "checking" });

      const res = await supabase
        .rpc("check_username_available_v1", { p_username: norm })
        .single();

      if (res.error) {
        setUStatus({ kind: "error", message: res.error.message ?? "Failed to check username" });
        return;
      }

      const row = res.data as unknown as UsernameCheckRow;

      lastChecked.current = row.normalized ?? norm;

      if (!row.is_valid) {
        setUStatus({
          kind: "invalid",
          normalized: row.normalized ?? norm,
          reason: row.reason ?? "invalid",
        });
        return;
      }

      if (row.is_available) {
        setUStatus({ kind: "available", normalized: row.normalized ?? norm });
      } else {
        setUStatus({ kind: "taken", normalized: row.normalized ?? norm });
      }
    },
    []
  );

  // Debounce username availability check
  useEffect(() => {
    const norm = normalizeUsernameInput((draft as any).username ?? "");
    // Keep the input in sync with normalization (optional but helps)
    // Only rewrite if user typed invalid chars/spaces
    if ((draft as any).username != null && (draft as any).username !== norm) {
      onChange("username" as any, norm as any);
    }

    const t = setTimeout(() => {
      checkUsername(norm);
    }, 350);

    return () => clearTimeout(t);
  }, [checkUsername, (draft as any).username, onChange]);

  const usernameHelper = useMemo(() => {
    if (uStatus.kind === "idle") return "3–13 characters • letters, numbers, underscores";
    if (uStatus.kind === "checking") return "Checking availability…";
    if (uStatus.kind === "available") return `@${uStatus.normalized} is available`;
    if (uStatus.kind === "taken") return `@${uStatus.normalized} is taken`;
    if (uStatus.kind === "invalid") return usernameHintFromReason(uStatus.reason) ?? "Invalid username";
    if (uStatus.kind === "error") return uStatus.message;
    return null;
  }, [uStatus]);

  const usernameHelperTone = useMemo(() => {
    // style choices
    if (uStatus.kind === "available") return "ok";
    if (uStatus.kind === "checking" || uStatus.kind === "idle") return "neutral";
    return "bad";
  }, [uStatus.kind]);

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stepLabel} progress={progress} />

        <View style={styles.header}>
          <Text style={styles.h1}>About You</Text>
          <Text style={styles.sub}>
            We'll use this information to personalize your training experience and calculate your metrics.
          </Text>
        </View>

        <Field label="FULL NAME" error={errors.fullName}>
          <TextInput
            style={[styles.input, !!errors.fullName && styles.inputError]}
            placeholder="John Doe"
            placeholderTextColor={colors.textMuted}
            value={draft.fullName}
            onChangeText={(t) => onChange("fullName", t)}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        {/* ✅ Username field */}
        <Field label="USERNAME" error={(errors as any).username}>
          <View style={[styles.input, styles.rowInput, !!(errors as any).username && styles.inputError]}>
            <View style={styles.leftIcon}>
              <Text style={styles.leftIconText}>@</Text>
            </View>

            <TextInput
              style={[styles.rowText, { color: colors.text }]}
              placeholder="yourname"
              placeholderTextColor={colors.textMuted}
              value={(draft as any).username ?? ""}
              onChangeText={(t) => onChange("username" as any, normalizeUsernameInput(t) as any)}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
            />

            {uStatus.kind === "checking" ? (
              <ActivityIndicator />
            ) : uStatus.kind === "available" ? (
              <Text style={styles.okMark}>✓</Text>
            ) : uStatus.kind === "taken" || uStatus.kind === "invalid" || uStatus.kind === "error" ? (
              <Text style={styles.badMark}>!</Text>
            ) : null}
          </View>

          {!!usernameHelper && (
            <Text
              style={[
                styles.helper,
                usernameHelperTone === "ok" && styles.helperOk,
                usernameHelperTone === "bad" && styles.helperBad,
              ]}
            >
              {usernameHelper}
            </Text>
          )}
        </Field>

        <Field label="EMAIL ADDRESS">
          <TextInput
            style={[styles.input, styles.readOnly]}
            placeholder="john.doe@musclemetric.com"
            placeholderTextColor={colors.textMuted}
            value={draft.email}
            editable={false}
          />
        </Field>

        <Field label="DATE OF BIRTH" error={errors.dob}>
          <Pressable
            onPress={onOpenDob}
            style={[styles.input, styles.rowInput, !!errors.dob && styles.inputError]}
          >
            <Text
              style={[
                styles.rowText,
                { color: draft.dob ? colors.text : colors.textMuted },
              ]}
            >
              {dobLabel}
            </Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </Field>

        <Field label="GENDER" error={errors.gender}>
          <SegmentRow<Gender>
            value={draft.gender}
            onChange={(g) => onChange("gender", g)}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
            error={!!errors.gender}
          />
        </Field>
      </View>

      <PrimaryCTA
        title="Next"
        onPress={onNext}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
    </View>
  );
}

function formatDob(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    body: { flex: 1, paddingTop: 6, paddingHorizontal: 16 },

    header: {
      marginTop: 10,
      marginBottom: 22,
    },
    h1: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    sub: {
      color: colors.textMuted,
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      maxWidth: 360,
    },

    input: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: "rgba(255,255,255,0.04)",
      color: colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    readOnly: {
      opacity: 0.95,
    },
    inputError: {
      borderColor: "rgba(239,68,68,0.75)",
    },

    rowInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    leftIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      alignItems: "center",
      justifyContent: "center",
    },
    leftIconText: {
      fontSize: 14,
      opacity: 0.9,
      color: colors.textMuted,
      fontWeight: "900",
      marginTop: -1,
    },
    rowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      paddingVertical: 0,
      color: colors.text,
    },
    chev: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "900",
      marginTop: -2,
    },

    helper: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
    },
    helperOk: {
      color: "rgba(34,197,94,0.95)", // green-ish
    },
    helperBad: {
      color: "rgba(239,68,68,0.95)", // red-ish
    },

    okMark: {
      fontWeight: "900",
      color: "rgba(34,197,94,0.95)",
      fontSize: 16,
      marginLeft: 6,
    },
    badMark: {
      fontWeight: "900",
      color: "rgba(239,68,68,0.95)",
      fontSize: 16,
      marginLeft: 6,
    },

    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },
  });