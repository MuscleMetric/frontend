// app/features/onboarding/steps/AboutYouStep.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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
  const v = (raw ?? "").toLowerCase().trim();
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
    value: OnboardingDraft[K],
  ) => void;
  onOpenDob: () => void;
  onNext: () => void;
  stepLabel?: string;
  progress?: number;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dobLabel = draft.dob ? formatDob(draft.dob) : "Optional";

  const isAppleUser =
    (draft as any).provider === "apple" ||
    draft.email?.includes("privaterelay.appleid.com");

  const appleProvidedName = Boolean((draft as any).appleProvidedName);
  const hasAppleName = isAppleUser && appleProvidedName && !!draft.fullName?.trim();
  const appleNameMissing = isAppleUser && !appleProvidedName;
  const shouldLockName = hasAppleName;

  const [uStatus, setUStatus] = useState<UsernameStatus>({ kind: "idle" });
  const lastChecked = useRef<string>("");

  const checkUsername = useCallback(async (username: string) => {
    const norm = normalizeUsernameInput(username);

    if (!norm) {
      setUStatus({ kind: "idle" });
      lastChecked.current = "";
      return;
    }

    if (lastChecked.current === norm) return;

    setUStatus({ kind: "checking" });

    const res = await supabase
      .rpc("check_username_available_v1", { p_username: norm })
      .single();

    if (res.error) {
      setUStatus({
        kind: "error",
        message: res.error.message ?? "Failed to check username",
      });
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
  }, []);

  useEffect(() => {
    const norm = normalizeUsernameInput((draft as any).username ?? "");

    if ((draft as any).username != null && (draft as any).username !== norm) {
      onChange("username" as any, norm as any);
    }

    const t = setTimeout(() => {
      checkUsername(norm);
    }, 350);

    return () => clearTimeout(t);
  }, [checkUsername, (draft as any).username, onChange]);

  const usernameHelper = useMemo(() => {
    if (uStatus.kind === "idle")
      return "3–13 characters • letters, numbers, underscores";
    if (uStatus.kind === "checking") return "Checking availability…";
    if (uStatus.kind === "available") return `@${uStatus.normalized} is available`;
    if (uStatus.kind === "taken") return `@${uStatus.normalized} is taken`;
    if (uStatus.kind === "invalid")
      return usernameHintFromReason(uStatus.reason) ?? "Invalid username";
    if (uStatus.kind === "error") return uStatus.message;
    return null;
  }, [uStatus]);

  const usernameHelperTone = useMemo(() => {
    if (uStatus.kind === "available") return "ok";
    if (uStatus.kind === "checking" || uStatus.kind === "idle") return "neutral";
    return "bad";
  }, [uStatus.kind]);

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stepper label={stepLabel} progress={progress} />

          <View style={styles.header}>
            <Text style={styles.h1}>About You</Text>
            <Text style={styles.sub}>
              Add the basics for your profile. Date of birth and gender are optional
              and are only used to improve metric estimates.
            </Text>
          </View>

          <Field label="FULL NAME" error={errors.fullName}>
            <TextInput
              style={[
                styles.input,
                shouldLockName && styles.readOnly,
                !!errors.fullName && styles.inputError,
              ]}
              placeholder="John Doe"
              placeholderTextColor={colors.textMuted}
              value={draft.fullName}
              onChangeText={(t) => {
                if (!shouldLockName) onChange("fullName", t);
              }}
              editable={!shouldLockName}
              autoCapitalize="words"
              returnKeyType="next"
            />

            {hasAppleName && (
              <Text style={styles.helper}>Name provided by Apple</Text>
            )}

            {appleNameMissing && (
              <Text style={styles.helper}>
                Apple did not provide your name. You can add it here, or continue
                without it.
              </Text>
            )}
          </Field>

          <Field label="USERNAME" error={(errors as any).username}>
            <View
              style={[
                styles.input,
                styles.rowInput,
                !!(errors as any).username && styles.inputError,
              ]}
            >
              <View style={styles.leftIcon}>
                <Text style={styles.leftIconText}>@</Text>
              </View>

              <TextInput
                style={styles.rowText}
                placeholder="yourname"
                placeholderTextColor={colors.textMuted}
                value={(draft as any).username ?? ""}
                onChangeText={(t) =>
                  onChange("username" as any, normalizeUsernameInput(t) as any)
                }
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
              />

              {uStatus.kind === "checking" ? (
                <ActivityIndicator />
              ) : uStatus.kind === "available" ? (
                <Text style={styles.okMark}>✓</Text>
              ) : uStatus.kind === "taken" ||
                uStatus.kind === "invalid" ||
                uStatus.kind === "error" ? (
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
              value={draft.email}
              editable={false}
            />
          </Field>

          <Field label="DATE OF BIRTH — OPTIONAL">
            <Pressable
              onPress={onOpenDob}
              style={[styles.input, styles.rowInput]}
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

            <View style={styles.optionalRow}>
              <Text style={styles.helper}>
                Used only to improve age-based training estimates.
              </Text>

              {!!draft.dob && (
                <Pressable onPress={() => onChange("dob", null as any)}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              )}
            </View>
          </Field>

          <Field label="GENDER — OPTIONAL">
            <SegmentRow<Gender>
              value={draft.gender}
              onChange={(g) => onChange("gender", g)}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              error={false}
            />

            <View style={styles.optionalRow}>
              <Text style={styles.helper}>
                Optional. Used only to improve training recommendations.
              </Text>

              {!!draft.gender && (
                <Pressable onPress={() => onChange("gender", null as any)}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              )}
            </View>
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

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
    keyboard: { flex: 1 },
    body: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 120 },

    header: { marginTop: 10, marginBottom: 22 },
    h1: { color: colors.text, fontSize: 34, fontWeight: "900" },
    sub: { color: colors.textMuted, marginTop: 10, fontSize: 14, lineHeight: 20 },

    input: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: "rgba(255,255,255,0.04)",
      color: colors.text,
      fontWeight: "800",
    },

    readOnly: { opacity: 0.6 },
    inputError: { borderColor: "rgba(239,68,68,0.75)" },

    rowInput: { flexDirection: "row", alignItems: "center" },

    leftIcon: { width: 26, height: 26, borderRadius: 13 },
    leftIconText: { fontSize: 14, color: colors.textMuted, fontWeight: "800" },

    rowText: { flex: 1, color: colors.text, fontWeight: "800" },

    chev: { color: colors.textMuted, fontSize: 24 },

    optionalRow: {
      marginTop: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },

    helper: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    helperOk: { color: "rgba(34,197,94,0.95)" },
    helperBad: { color: "rgba(239,68,68,0.95)" },

    clearText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
      opacity: 0.8,
    },

    okMark: { color: "rgba(34,197,94,0.95)", fontWeight: "900" },
    badMark: { color: "rgba(239,68,68,0.95)", fontWeight: "900" },

    arrow: { color: "#fff" },
  });