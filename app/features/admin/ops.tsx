// app/features/admin/ops.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/authContext";
import { useAppTheme } from "../../../lib/useAppTheme";
import { useRouter } from "expo-router";

type OpsJob = {
  job_key: string;
  title: string;
  enabled: boolean;
  status: "running" | "success" | "error" | "never" | string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  is_late: boolean;
};

type OpsError = {
  id: string;
  created_at: string;
  source: string;
  level: string;
  event_key: string;
  message: string;
  user_id: string | null;
  meta: any;
};

type OpsSnapshot = {
  jobs: OpsJob[];
  recent_errors: OpsError[];
};

type JobRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  rows_processed: number | null;
  rows_updated: number | null;
  rows_inserted: number | null;
  error_message: string | null;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMs(ms?: number | null) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const s2 = Math.round(s % 60);
  return `${m}m ${s2}s`;
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function pillColor(colors: any, status: string, isLate: boolean) {
  if (isLate)
    return {
      bg: "rgba(245,158,11,0.14)",
      fg: "#f59e0b",
      br: "rgba(245,158,11,0.35)",
    };
  if (status === "success")
    return {
      bg: "rgba(34,197,94,0.14)",
      fg: "#22c55e",
      br: "rgba(34,197,94,0.35)",
    };
  if (status === "error")
    return {
      bg: "rgba(239,68,68,0.14)",
      fg: "#ef4444",
      br: "rgba(239,68,68,0.35)",
    };
  if (status === "running")
    return {
      bg: "rgba(59,130,246,0.14)",
      fg: colors.primary,
      br: "rgba(59,130,246,0.35)",
    };
  return {
    bg: "rgba(148,163,184,0.10)",
    fg: colors.muted ?? colors.subtle,
    br: "rgba(148,163,184,0.25)",
  };
}

export default function AdminOpsScreen() {
  const { session, profile, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const isAdmin = profile?.role === "admin";

  const router = useRouter();

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // job detail modal
  const [jobModalKey, setJobModalKey] = useState<string | null>(null);
  const [jobRunsLoading, setJobRunsLoading] = useState(false);
  const [jobRuns, setJobRuns] = useState<JobRunRow[]>([]);

  const load = useCallback(async () => {
    if (!userId || !isAdmin) return;
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.rpc("admin_ops_snapshot_v1");
    if (error) {
      setError(error.message);
      setData(null);
      setLoading(false);
      return;
    }

    setData(data as OpsSnapshot);
    setLoading(false);
  }, [userId, isAdmin]);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
    if (!authLoading && !isAdmin) setLoading(false);
  }, [authLoading, isAdmin, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const jobs = data?.jobs ?? [];
  const recentErrors = data?.recent_errors ?? [];

  const lateCount = jobs.filter((j) => j.is_late).length;
  const failingCount = jobs.filter((j) => j.status === "error").length;

  const openJob = useCallback(async (jobKey: string) => {
    setJobModalKey(jobKey);
    setJobRuns([]);
    setJobRunsLoading(true);

    const { data, error } = await supabase.rpc("admin_job_runs_recent", {
      p_job_key: jobKey,
      p_limit: 12,
    });

    setJobRunsLoading(false);

    if (error) {
      setJobRuns([]);
      return;
    }

    setJobRuns((data ?? []) as JobRunRow[]);
  }, []);

  if (authLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted ?? colors.subtle }}>
          Not authorized.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={20} color={colors.primary} />
            <Text style={s.backText}>Back</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={s.h1}>Ops</Text>
            <Text style={s.mutedSmall}>Reliability snapshot • Cron + jobs</Text>
          </View>

          <Pressable onPress={load} style={s.refreshBtn} hitSlop={10}>
            <Feather name="refresh-ccw" size={18} color={colors.primary} />
            <Text style={s.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={[s.card, { alignItems: "center", paddingVertical: 22 }]}>
            <ActivityIndicator />
            <Text style={[s.mutedSmall, { marginTop: 10 }]}>
              Loading ops snapshot…
            </Text>
          </View>
        ) : error ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Failed to load</Text>
            <Text style={s.mutedSmall}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Health strip */}
            <View style={s.healthRow}>
              <View style={s.healthTile}>
                <Text style={s.healthLabel}>Late</Text>
                <Text style={s.healthValue}>{lateCount}</Text>
              </View>
              <View style={s.healthTile}>
                <Text style={s.healthLabel}>Failing</Text>
                <Text style={s.healthValue}>{failingCount}</Text>
              </View>
              <View style={s.healthTile}>
                <Text style={s.healthLabel}>Jobs</Text>
                <Text style={s.healthValue}>{jobs.length}</Text>
              </View>
            </View>

            {/* Jobs */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Jobs</Text>
              <Text style={s.mutedSmall}>Tap a job to see recent runs.</Text>
              <View style={{ height: 10 }} />

              {jobs.length === 0 ? (
                <Text style={s.mutedSmall}>No job definitions found.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {jobs.map((j) => {
                    const pill = pillColor(colors, j.status, j.is_late);
                    const subtitle =
                      j.status === "never"
                        ? "Never run"
                        : `Last: ${fmtDateTime(j.started_at)} • ${fmtMs(
                            j.duration_ms
                          )}`;

                    return (
                      <Pressable
                        key={j.job_key}
                        onPress={() => openJob(j.job_key)}
                        style={s.jobRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.jobTitle} numberOfLines={1}>
                            {j.title}
                          </Text>
                          <Text style={s.jobSub} numberOfLines={1}>
                            {subtitle}
                          </Text>

                          {j.status === "error" && j.error_message ? (
                            <Text style={s.jobErr} numberOfLines={2}>
                              {j.error_message}
                            </Text>
                          ) : null}

                          {!j.enabled ? (
                            <Text style={s.disabledTag}>Disabled</Text>
                          ) : null}
                        </View>

                        <View
                          style={[
                            s.pill,
                            {
                              backgroundColor: pill.bg,
                              borderColor: pill.br,
                            },
                          ]}
                        >
                          <Text style={[s.pillText, { color: pill.fg }]}>
                            {j.is_late
                              ? "LATE"
                              : String(j.status || "—").toUpperCase()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Errors feed (local) */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Recent errors (local)</Text>
              <Text style={s.mutedSmall}>
                Lightweight feed. Sentry is your source of truth for stacks.
              </Text>
              <View style={{ height: 10 }} />

              {recentErrors.length === 0 ? (
                <Text style={s.mutedSmall}>No recent errors logged.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {recentErrors.slice(0, 12).map((e) => (
                    <View key={e.id} style={s.errRow}>
                      <View style={s.errTopRow}>
                        <Text style={s.errKey} numberOfLines={1}>
                          {e.source} • {e.event_key}
                        </Text>
                        <Text style={s.errTime}>
                          {fmtDateTime(e.created_at)}
                        </Text>
                      </View>
                      <Text style={s.errMsg} numberOfLines={2}>
                        {e.message}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Job detail modal */}
      <Modal
        visible={!!jobModalKey}
        transparent
        animationType="slide"
        onRequestClose={() => setJobModalKey(null)}
      >
        <Pressable onPress={() => setJobModalKey(null)} style={s.modalBackdrop}>
          <Pressable onPress={() => {}} style={s.modalSheet}>
            <View style={s.modalHandle} />

            <Text style={s.modalTitle} numberOfLines={1}>
              {jobs.find((x) => x.job_key === jobModalKey)?.title ??
                jobModalKey}
            </Text>
            <Text style={s.mutedSmall}>Last 12 runs</Text>

            <View style={{ height: 12 }} />

            {jobRunsLoading ? (
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <ActivityIndicator />
              </View>
            ) : jobRuns.length === 0 ? (
              <Text style={s.mutedSmall}>No runs recorded yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {jobRuns.map((r) => {
                  const pill = pillColor(colors, r.status, false);
                  return (
                    <View key={r.id} style={s.runRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.runTitle}>
                          {fmtDateTime(r.started_at)} • {fmtMs(r.duration_ms)}
                        </Text>
                        {r.status === "error" && r.error_message ? (
                          <Text style={s.runErr} numberOfLines={2}>
                            {r.error_message}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          s.pill,
                          { backgroundColor: pill.bg, borderColor: pill.br },
                        ]}
                      >
                        <Text style={[s.pillText, { color: pill.fg }]}>
                          {String(r.status).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 14 }} />
            <Pressable onPress={() => setJobModalKey(null)} style={s.closeBtn}>
              <Text style={s.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2,
      gap: 12,
    },
    h1: { fontSize: 22, fontWeight: "900", color: colors.text },
    refreshBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    refreshText: { color: colors.primary, fontWeight: "900" },

    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    mutedSmall: {
      color: colors.muted ?? colors.subtle,
      marginTop: 4,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
    },

    healthRow: { flexDirection: "row", gap: 10 },
    healthTile: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    healthLabel: {
      color: colors.muted ?? colors.subtle,
      fontWeight: "800",
      fontSize: 12,
    },
    healthValue: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 22,
      marginTop: 6,
    },

    jobRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
    },
    jobTitle: { color: colors.text, fontWeight: "900" },
    jobSub: {
      color: colors.muted ?? colors.subtle,
      marginTop: 2,
      fontWeight: "700",
      fontSize: 12,
    },
    jobErr: { color: "#ef4444", marginTop: 6, fontWeight: "800", fontSize: 12 },
    disabledTag: {
      marginTop: 8,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(148,163,184,0.35)",
      color: colors.muted ?? colors.subtle,
      fontWeight: "900",
      fontSize: 12,
      overflow: "hidden",
    },

    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      alignSelf: "flex-start",
    },
    pillText: { fontWeight: "900", fontSize: 12, letterSpacing: 0.3 },

    errRow: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 10,
      backgroundColor: colors.surface ?? colors.card,
    },
    errTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      alignItems: "center",
    },
    errKey: { color: colors.text, fontWeight: "900", flex: 1 },
    errTime: {
      color: colors.muted ?? colors.subtle,
      fontWeight: "800",
      fontSize: 12,
    },
    errMsg: {
      color: colors.muted ?? colors.subtle,
      marginTop: 4,
      fontWeight: "700",
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
      minHeight: 260,
    },
    modalHandle: {
      width: 44,
      height: 5,
      borderRadius: 99,
      alignSelf: "center",
      backgroundColor: "rgba(120,120,120,0.35)",
      marginBottom: 10,
    },
    modalTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },

    runRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
    },
    runTitle: { color: colors.text, fontWeight: "900" },
    runErr: { color: "#ef4444", marginTop: 6, fontWeight: "800", fontSize: 12 },

    closeBtn: {
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
    },
    closeText: { color: colors.text, fontWeight: "900" },

    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    backText: { color: colors.primary, fontWeight: "900" },
  });
