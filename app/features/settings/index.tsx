import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type SettingsRow = {
  user_id: string;
  name: string | null;
  username: string | null;
  username_lower: string | null;
  is_private: boolean;
};

type UsernameCheckRow = {
  normalized: string;
  is_valid: boolean;
  is_available: boolean;
  reason: string | null;
};

export default function SettingsScreen() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg },
        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },

        body: { padding: layout.space.lg, gap: layout.space.lg },

        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: 10,
        },

        label: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        },

        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
        },

        helper: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
        helperOk: { color: colors.primary },
        helperBad: { color: colors.danger },

        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },

        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        ghost: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        ghostText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<SettingsRow | null>(null);

  const [username, setUsername] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckRow | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  const [isPrivate, setIsPrivate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await supabase.rpc("get_settings_v1");
    if (res.error) {
      console.log("get settings error:", res.error);
      setSettings(null);
      setLoading(false);
      return;
    }

    const row = Array.isArray(res.data) ? (res.data[0] as SettingsRow | undefined) : undefined;
    setSettings(row ?? null);

    const u = row?.username ?? "";
    setUsername(u);
    setIsPrivate(!!row?.is_private);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced availability check
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!settings) return;

      const trimmed = username.trim();
      if (!trimmed) {
        setUsernameCheck(null);
        return;
      }

      // if unchanged, don’t spam check
      if ((settings.username ?? "").trim() === trimmed) {
        setUsernameCheck({
          normalized: settings.username_lower ?? trimmed.toLowerCase(),
          is_valid: true,
          is_available: true,
          reason: null,
        });
        return;
      }

      setCheckingName(true);
      const res = await supabase.rpc("check_username_available_v1", { p_username: trimmed });
      if (!alive) return;

      if (res.error) {
        console.log("check username error:", res.error);
        setUsernameCheck(null);
      } else {
        const r = Array.isArray(res.data) ? (res.data[0] as UsernameCheckRow | undefined) : undefined;
        setUsernameCheck(r ?? null);
      }
      setCheckingName(false);
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [username, settings]);

  const saveUsername = useCallback(async () => {
    if (!settings) return;

    const trimmed = username.trim();
    if (!trimmed) {
      Alert.alert("Username required", "Please set a username.");
      return;
    }

    // quick gate: only allow save if check says OK (or unchanged)
    const unchanged = (settings.username ?? "").trim() === trimmed;
    const ok = unchanged || (!!usernameCheck?.is_valid && !!usernameCheck?.is_available);

    if (!ok) {
      Alert.alert("Username not available", "Please choose another username.");
      return;
    }

    setSaving(true);
    const res = await supabase.rpc("set_username_v1", { p_username: trimmed });
    if (res.error) {
      console.log("set username error:", res.error);
      Alert.alert("Couldn’t save username", res.error.message ?? "Try again.");
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    Alert.alert("Saved", "Username updated.");
  }, [settings, username, usernameCheck, load]);

  const savePrivacy = useCallback(
    async (next: boolean) => {
      setIsPrivate(next); // optimistic
      const res = await supabase.rpc("set_privacy_v1", { p_is_private: next });
      if (res.error) {
        console.log("privacy error:", res.error);
        // revert
        setIsPrivate((v) => !v);
        Alert.alert("Couldn’t update privacy", res.error.message ?? "Try again.");
      }
    },
    []
  );

  const usernameHint = useMemo(() => {
    if (!username.trim()) return { text: "3–10 chars, a–z 0–9 _ (no spaces).", tone: "muted" as const };
    if (checkingName) return { text: "Checking…", tone: "muted" as const };
    if (!usernameCheck) return { text: "3–10 chars, a–z 0–9 _ (no spaces).", tone: "muted" as const };

    if (!usernameCheck.is_valid) {
      const reason = usernameCheck.reason ?? "invalid";
      return { text: `Not allowed (${reason}).`, tone: "bad" as const };
    }
    if (!usernameCheck.is_available) return { text: "Username taken.", tone: "bad" as const };
    return { text: "Looks good.", tone: "ok" as const };
  }, [username, usernameCheck, checkingName]);

  const canSave =
    !!settings &&
    !!username.trim() &&
    (((settings.username ?? "").trim() === username.trim()) ||
      (!!usernameCheck?.is_valid && !!usernameCheck?.is_available)) &&
    !saving;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {loading ? (
          <View style={[styles.body, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.card}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="e.g. Harry"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text
                style={[
                  styles.helper,
                  usernameHint.tone === "ok" && styles.helperOk,
                  usernameHint.tone === "bad" && styles.helperBad,
                ]}
              >
                {usernameHint.text}
              </Text>

              <Pressable
                style={[styles.btn, { opacity: canSave ? 1 : 0.5 }]}
                onPress={saveUsername}
                disabled={!canSave}
              >
                {saving ? <ActivityIndicator /> : <Text style={styles.btnText}>Save username</Text>}
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Privacy</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: typography.fontFamily.medium, fontSize: typography.size.body }}>
                    Private account
                  </Text>
                  <Text style={styles.helper}>
                    If private, only followers can see your posts.
                  </Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={savePrivacy}
                />
              </View>
            </View>

            <Pressable style={styles.ghost} onPress={() => router.back()}>
              <Text style={styles.ghostText}>Back</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}