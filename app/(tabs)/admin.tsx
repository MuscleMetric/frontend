import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../../lib/useAppTheme";
import { useAuth } from "../../lib/authContext";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * =========================================================
 * Types
 * =========================================================
 */

type RangeKey = "7d" | "30d" | "90d";
const RANGE_TO_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

type DashboardPayload = {
  kpis: {
    new_1d: number;
    new_7d: number;
    new_30d: number;
    active_7d: number;
    workouts_7d: number;
    workouts_30d: number;
    sets_7d: number;
    sets_30d: number;
    activation_24h_rate: number; // 0..1
    retention_7d_2plus_rate: number; // 0..1
    total_users: number;
    zero_workouts: number;
    one_workout: number;
    missing_sets_30d: number;
  };
  trends: {
    new_users_daily: { day: string; count: number }[];
    active_users_weekly: { week_start: string; active_users: number }[];
  };
  content: {
    top_exercises_30d: { name: string; count: number }[];
    equipment_dist_30d: { equipment: string; count: number }[];
  };
};

type AdminUserSearchRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  role: string;
};

type AdminUserSummary = {
  found: boolean;
  profile?: {
    id: string;
    email: string | null;
    name: string | null;
    created_at: string;
    date_of_birth: string | null;
    timezone: string;
    weekly_streak: number;
    weekly_workout_goal: number;
    steps_goal: number;
    role: string;
    settings: any;
    active_plan_id: string | null;
    active_plan_title: string | null;
  };
  stats?: {
    workouts_total: number;
    sets_total: number;
    last_workout_at: string | null;
    active_goals: number;
    total_volume: number;
    most_performed_exercise_30d: string | null;
  };
};

type AdminAlert = {
  key: string; // unique id for UI + drilldown routing
  severity: "good" | "ok" | "bad" | "neutral";
  title: string;
  description?: string | null;
  count?: number | null;
  cta_label?: string | null;
  drilldown?: "zero_workouts" | "missing_sets" | "one_workout" | "new_users";
};

type DrilldownRow =
  | {
      kind: "user";
      user_id: string;
      email: string | null;
      name: string | null;
      created_at: string;
      meta?: string | null;
    }
  | {
      kind: "workout";
      workout_history_id: string;
      user_id: string;
      email: string | null;
      name: string | null;
      completed_at: string;
      workout_title: string | null;
      meta?: string | null;
    };

/**
 * =========================================================
 * Helpers
 * =========================================================
 */

function formatDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeShort(iso?: string | null) {
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

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function formatVolume(v?: number | null) {
  const n = typeof v === "number" ? v : 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
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

function severityTint(sev: AdminAlert["severity"]) {
  if (sev === "good") return "#22c55e";
  if (sev === "ok") return "#f59e0b";
  if (sev === "bad") return "#ef4444";
  return null;
}

/**
 * =========================================================
 * UI Components
 * =========================================================
 */

function SectionTitle({
  title,
  sub,
  colors,
  right,
}: {
  title: string;
  sub?: string;
  colors: any;
  right?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
          {title}
        </Text>
        {!!sub && (
          <Text
            style={{ color: colors.muted, marginTop: 2, fontWeight: "700" }}
          >
            {sub}
          </Text>
        )}
      </View>
      {!!right && <View>{right}</View>}
    </View>
  );
}

function RangePills({
  value,
  onChange,
  colors,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
  colors: any;
}) {
  const opts: RangeKey[] = ["7d", "30d", "90d"];
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {opts.map((k) => {
        const active = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active
                ? hexToRgba(colors.primary, 0.5)
                : colors.border,
              backgroundColor: active
                ? hexToRgba(colors.primary, 0.14)
                : colors.card,
            }}
          >
            <Text
              style={{
                color: active ? colors.primary : colors.text,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {k.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FullCard({
  children,
  colors,
  style,
}: {
  children: React.ReactNode;
  colors: any;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.fullCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function MetricRow({
  label,
  value,
  sub,
  colors,
  status = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  colors: any;
  status?: "good" | "ok" | "bad" | "neutral";
}) {
  const tint = severityTint(status);
  return (
    <View
      style={{
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }}>
          {label}
        </Text>
        <Text style={{ color: tint ?? colors.text, fontWeight: "900" }}>
          {value}
        </Text>
      </View>
      {!!sub && (
        <Text style={{ color: colors.muted, marginTop: 2, fontWeight: "700" }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function AlertCard({
  a,
  colors,
  onPress,
}: {
  a: AdminAlert;
  colors: any;
  onPress?: () => void;
}) {
  const tint = severityTint(a.severity);
  const borderColor = tint ? hexToRgba(tint, 0.45) : colors.border;
  const bgColor = tint ? hexToRgba(tint, 0.1) : hexToRgba(colors.text, 0.03);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor,
        backgroundColor: bgColor,
        borderRadius: 18,
        padding: 14,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            backgroundColor: tint ?? colors.border,
          }}
        />
        <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }}>
          {a.title}
        </Text>
        {typeof a.count === "number" && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: borderColor,
              backgroundColor: hexToRgba(colors.text, 0.03),
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {a.count}
            </Text>
          </View>
        )}
      </View>

      {!!a.description && (
        <Text
          style={{ color: colors.muted, fontWeight: "700", lineHeight: 18 }}
        >
          {a.description}
        </Text>
      )}

      {!!a.cta_label && (
        <Text
          style={{ color: colors.primary, fontWeight: "900", marginTop: 2 }}
        >
          {a.cta_label} →
        </Text>
      )}
    </Pressable>
  );
}

/**
 * =========================================================
 * Main Screen
 * =========================================================
 */

export default function AdminScreen() {
  const { colors } = useAppTheme();
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "admin";
  const router = useRouter();

  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // priorities (from either RPC or derived from dashboard)
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  // Drilldown modal
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<DrilldownRow[]>([]);

  // User inspector modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<AdminUserSummary | null>(null);

  // Quick search (still useful)
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminUserSearchRow[]>([]);

  const days = RANGE_TO_DAYS[range];

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      // you already have this RPC
      const { data, error } = await supabase.rpc("admin_dashboard_v1");
      if (error) throw error;
      setData(data as DashboardPayload);
      setLastUpdatedAt(new Date());
    } catch (e: any) {
      setData(null);
      setError(e?.message ?? "Failed to load dashboard");
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    // NEW RPC: admin_alerts_v1(p_days int)
    // If it doesn't exist yet, we derive alerts from dashboard as a fallback.
    setAlertsError(null);

    try {
      const { data: a, error } = await supabase.rpc("admin_alerts_v1", {
        p_days: days,
      });

      if (error) throw error;
      setAlerts((a ?? []) as AdminAlert[]);
    } catch (e: any) {
      // fallback derived from dashboard if available
      setAlertsError(e?.message ?? "Missing admin_alerts_v1 RPC");
      if (!data) return;

      const total = Math.max(1, data.kpis.total_users);
      const activation = data.kpis.activation_24h_rate;
      const retention = data.kpis.retention_7d_2plus_rate;

      const zeroPct = data.kpis.zero_workouts / total;

      const derived: AdminAlert[] = [
        {
          key: "activation",
          severity:
            activation >= 0.3 ? "good" : activation >= 0.15 ? "ok" : "bad",
          title: `Activation ${pct(activation)}`,
          description: "Workout within 24h of signup (system-wide).",
          count: null,
          cta_label: "Improve onboarding funnel",
          drilldown: "new_users",
        },
        {
          key: "retention",
          severity:
            retention >= 0.25 ? "good" : retention >= 0.12 ? "ok" : "bad",
          title: `7d Retention ${pct(retention)}`,
          description: "Users with ≥2 workouts in 7 days.",
          count: null,
          cta_label: "See at-risk users",
          drilldown: "one_workout",
        },
        {
          key: "zero_workouts",
          severity: zeroPct < 0.35 ? "good" : zeroPct <= 0.55 ? "ok" : "bad",
          title: "Users with 0 workouts",
          description: "These users never logged a workout.",
          count: data.kpis.zero_workouts,
          cta_label: "View users",
          drilldown: "zero_workouts",
        },
        {
          key: "missing_sets",
          severity:
            data.kpis.missing_sets_30d === 0
              ? "good"
              : data.kpis.missing_sets_30d <= 2
              ? "ok"
              : "bad",
          title: "Workouts missing sets",
          description: "Workouts created but no set rows logged (last 30d).",
          count: data.kpis.missing_sets_30d,
          cta_label: "View workouts",
          drilldown: "missing_sets",
        },
      ];

      setAlerts(derived);
    }
  }, [days, data]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await loadDashboard();
    setLoading(false);
  }, [loadDashboard]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      (async () => {
        await loadAll();
      })();
    } else if (!authLoading && !isAdmin) {
      setLoading(false);
    }
  }, [authLoading, isAdmin, loadAll]);

  // reload alerts whenever dashboard OR range changes
  useEffect(() => {
    if (!isAdmin) return;
    loadAlerts();
  }, [isAdmin, loadAlerts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  async function runSearch() {
    const query = q.trim();
    if (!query) return;

    setSearching(true);
    try {
      const { data, error } = await supabase.rpc("admin_search_users", {
        q: query,
        lim: 10,
      });
      if (error) throw error;
      setSearchResults((data ?? []) as AdminUserSearchRow[]);
    } catch (e: any) {
      Alert.alert("Search failed", e?.message ?? "Unknown error");
    } finally {
      setSearching(false);
    }
  }

  async function openUser(userId: string) {
    setSelectedUserId(userId);
    setSummary(null);
    setSummaryLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_user_summary", {
        p_user_id: userId,
      });
      if (error) throw error;
      setSummary(data as AdminUserSummary);
    } catch (e: any) {
      Alert.alert("Failed to load user", e?.message ?? "Unknown error");
      setSelectedUserId(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function openDrilldown(which: NonNullable<AdminAlert["drilldown"]>) {
    setDrillRows([]);
    setDrillError(null);
    setDrillLoading(true);
    setDrillOpen(true);

    const title =
      which === "zero_workouts"
        ? "Users with 0 workouts"
        : which === "one_workout"
        ? "Users with 1 workout"
        : which === "missing_sets"
        ? "Workouts missing sets"
        : "New users";

    setDrillTitle(title);

    try {
      // NEW RPCs:
      // - admin_users_zero_workouts(p_days int, p_lim int)
      // - admin_users_one_workout(p_days int, p_lim int)
      // - admin_workouts_missing_sets(p_days int, p_lim int)
      // - admin_new_users(p_days int, p_lim int)
      const rpcName =
        which === "zero_workouts"
          ? "admin_users_zero_workouts"
          : which === "one_workout"
          ? "admin_users_one_workout"
          : which === "missing_sets"
          ? "admin_workouts_missing_sets"
          : "admin_new_users";

      const { data, error } = await supabase.rpc(rpcName, {
        p_days: days,
        p_lim: 50,
      });

      if (error) throw error;

      setDrillRows((data ?? []) as DrilldownRow[]);
    } catch (e: any) {
      setDrillError(e?.message ?? "Missing drilldown RPC");
    } finally {
      setDrillLoading(false);
    }
  }

  /**
   * Build nicer “headline cards” based on dashboard.
   */
  const headline = useMemo(() => {
    if (!data) return null;
    const activation = data.kpis.activation_24h_rate;
    const retention = data.kpis.retention_7d_2plus_rate;

    return {
      activation,
      retention,
      active7d: data.kpis.active_7d,
      workouts7d: data.kpis.workouts_7d,
      sets7d: data.kpis.sets_7d,
      new7d: data.kpis.new_7d,
    };
  }, [data]);

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted, fontWeight: "800" }}>
          Not authorized.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={110}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}
              >
                Admin
              </Text>
              <Text
                style={{ color: colors.muted, fontWeight: "700", marginTop: 2 }}
              >
                {lastUpdatedAt
                  ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "—"}
              </Text>
            </View>

            <Pressable
              onPress={onRefresh}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                backgroundColor: colors.card,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Feather name="refresh-ccw" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Refresh
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/features/admin/ops")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                backgroundColor: colors.card,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Feather name="activity" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "900" }}>Ops</Text>
            </Pressable>
          </View>

          {/* Range */}
          <FullCard colors={colors}>
            <SectionTitle
              title="Scope"
              sub="Controls alert + drilldown windows"
              colors={colors}
              right={
                <RangePills value={range} onChange={setRange} colors={colors} />
              }
            />
          </FullCard>

          {/* Loading / error */}
          {loading ? (
            <FullCard colors={colors}>
              <View
                style={{ alignItems: "center", paddingVertical: 14, gap: 8 }}
              >
                <ActivityIndicator />
                <Text style={{ color: colors.muted, fontWeight: "700" }}>
                  Loading dashboard…
                </Text>
              </View>
            </FullCard>
          ) : error ? (
            <FullCard colors={colors}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Failed to load
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>{error}</Text>
            </FullCard>
          ) : data && headline ? (
            <>
              {/* Headline KPIs */}
              <View style={styles.grid}>
                <View
                  style={[
                    styles.tile,
                    {
                      backgroundColor: hexToRgba(colors.primary, 0.1),
                      borderColor: hexToRgba(colors.primary, 0.35),
                    },
                  ]}
                >
                  <Text style={[styles.tileLabel, { color: colors.muted }]}>
                    Activation (24h)
                  </Text>
                  <Text style={[styles.tileValue, { color: colors.text }]}>
                    {pct(headline.activation)}
                  </Text>
                  <Text style={[styles.tileSub, { color: colors.muted }]}>
                    workout within 24h
                  </Text>
                </View>

                <View
                  style={[
                    styles.tile,
                    {
                      backgroundColor: hexToRgba(colors.text, 0.03),
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tileLabel, { color: colors.muted }]}>
                    Retention (7d)
                  </Text>
                  <Text style={[styles.tileValue, { color: colors.text }]}>
                    {pct(headline.retention)}
                  </Text>
                  <Text style={[styles.tileSub, { color: colors.muted }]}>
                    ≥2 workouts in 7d
                  </Text>
                </View>

                <View
                  style={[
                    styles.tile,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tileLabel, { color: colors.muted }]}>
                    Active users
                  </Text>
                  <Text style={[styles.tileValue, { color: colors.text }]}>
                    {headline.active7d}
                  </Text>
                  <Text style={[styles.tileSub, { color: colors.muted }]}>
                    last 7 days
                  </Text>
                </View>

                <View
                  style={[
                    styles.tile,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tileLabel, { color: colors.muted }]}>
                    Workouts / Sets
                  </Text>
                  <Text style={[styles.tileValue, { color: colors.text }]}>
                    {headline.workouts7d} / {headline.sets7d}
                  </Text>
                  <Text style={[styles.tileSub, { color: colors.muted }]}>
                    last 7 days
                  </Text>
                </View>
              </View>

              {/* Priorities */}
              <FullCard colors={colors}>
                <SectionTitle
                  title="Priorities"
                  sub={
                    alertsError
                      ? `Using fallback (missing RPC): ${alertsError}`
                      : "Tap an item to drill down"
                  }
                  colors={colors}
                />

                <View style={{ height: 12 }} />

                <View style={{ gap: 10 }}>
                  {alerts.map((a) => (
                    <AlertCard
                      key={a.key}
                      a={a}
                      colors={colors}
                      onPress={
                        a.drilldown
                          ? () => openDrilldown(a.drilldown!)
                          : undefined
                      }
                    />
                  ))}
                </View>
              </FullCard>

              {/* Diagnostics (quick scan) */}
              <FullCard colors={colors}>
                <SectionTitle
                  title="Diagnostics"
                  sub="Fast scan of common data issues"
                  colors={colors}
                />

                <MetricRow
                  label="Users with 0 workouts"
                  value={`${data.kpis.zero_workouts}`}
                  sub="all time"
                  colors={colors}
                  status="ok"
                />
                <MetricRow
                  label="Users with 1 workout"
                  value={`${data.kpis.one_workout}`}
                  sub="all time"
                  colors={colors}
                  status="neutral"
                />
                <MetricRow
                  label="Missing sets"
                  value={`${data.kpis.missing_sets_30d}`}
                  sub="workouts w/ no set rows (30d)"
                  colors={colors}
                  status={data.kpis.missing_sets_30d === 0 ? "good" : "bad"}
                />
              </FullCard>

              {/* Content */}
              <FullCard colors={colors}>
                <SectionTitle
                  title="Content (30d)"
                  sub="What the app is actually used for"
                  colors={colors}
                />

                <View style={{ height: 10 }} />

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 14,
                  }}
                >
                  Top exercises
                </Text>

                {data.content.top_exercises_30d.length === 0 ? (
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    No data yet.
                  </Text>
                ) : (
                  data.content.top_exercises_30d.slice(0, 10).map((x, i) => (
                    <View
                      key={`${x.name}-${i}`}
                      style={[
                        styles.row,
                        { borderTopColor: colors.border, paddingVertical: 10 },
                      ]}
                    >
                      <Text
                        style={{ color: colors.text, flex: 1 }}
                        numberOfLines={1}
                      >
                        {x.name}
                      </Text>
                      <Text style={{ color: colors.muted, fontWeight: "900" }}>
                        {x.count}
                      </Text>
                    </View>
                  ))
                )}

                <View style={{ height: 14 }} />

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 14,
                  }}
                >
                  Equipment
                </Text>

                {data.content.equipment_dist_30d.length === 0 ? (
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    No data yet.
                  </Text>
                ) : (
                  data.content.equipment_dist_30d.slice(0, 8).map((x, i) => (
                    <View
                      key={`${x.equipment}-${i}`}
                      style={[
                        styles.row,
                        { borderTopColor: colors.border, paddingVertical: 10 },
                      ]}
                    >
                      <Text
                        style={{ color: colors.text, flex: 1 }}
                        numberOfLines={1}
                      >
                        {x.equipment}
                      </Text>
                      <Text style={{ color: colors.muted, fontWeight: "900" }}>
                        {x.count}
                      </Text>
                    </View>
                  ))
                )}
              </FullCard>

              {/* User lookup (stays — but improved) */}
              <FullCard colors={colors}>
                <SectionTitle
                  title="User inspector"
                  sub="Search, then tap a user to open the profile summary"
                  colors={colors}
                />

                <View style={{ height: 10 }} />

                <View
                  style={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: hexToRgba(colors.text, 0.02),
                  }}
                >
                  <Feather name="search" size={16} color={colors.muted} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search by email or name…"
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, color: colors.text, fontWeight: "800" }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={runSearch}
                  />
                  <Pressable
                    onPress={runSearch}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: hexToRgba(colors.primary, 0.12),
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: hexToRgba(colors.primary, 0.25),
                    }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "900" }}>
                      {searching ? "…" : "Search"}
                    </Text>
                  </Pressable>
                </View>

                <View style={{ height: 10 }} />

                {searchResults.length === 0 ? (
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>
                    Tip: try your own email.
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {searchResults.map((u) => (
                      <Pressable
                        key={u.id}
                        onPress={() => openUser(u.id)}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        }}
                      >
                        <Text
                          style={{ color: colors.text, fontWeight: "900" }}
                          numberOfLines={1}
                        >
                          {u.name || u.email || u.id}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            marginTop: 2,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {u.email || "No email"} • {u.role} • Joined{" "}
                          {formatDateShort(u.created_at)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </FullCard>
            </>
          ) : null}

          {/* Drilldown modal */}
          <Modal
            visible={drillOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setDrillOpen(false)}
          >
            <Pressable
              onPress={() => setDrillOpen(false)}
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.35)",
                justifyContent: "flex-end",
              }}
            >
              <Pressable
                onPress={() => {}}
                style={{
                  backgroundColor: colors.card,
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 12,
                  minHeight: 360,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: 99,
                    alignSelf: "center",
                    backgroundColor: hexToRgba(colors.text, 0.18),
                    marginBottom: 6,
                  }}
                />

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 16,
                      flex: 1,
                    }}
                  >
                    {drillTitle}
                  </Text>
                  <Pressable onPress={() => setDrillOpen(false)} hitSlop={10}>
                    <Text style={{ color: colors.primary, fontWeight: "900" }}>
                      Close
                    </Text>
                  </Pressable>
                </View>

                <Text style={{ color: colors.muted, fontWeight: "700" }}>
                  Scope: {range.toUpperCase()} • Showing up to 50 rows
                </Text>

                {drillLoading ? (
                  <View style={{ paddingVertical: 30, alignItems: "center" }}>
                    <ActivityIndicator />
                  </View>
                ) : drillError ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Drilldown not available yet
                    </Text>
                    <Text style={{ color: colors.muted }}>{drillError}</Text>
                    <Text style={{ color: colors.muted }}>
                      Create the RPC shown in the message above (see SQL below).
                    </Text>
                  </View>
                ) : drillRows.length === 0 ? (
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>
                    No rows found.
                  </Text>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 420 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {drillRows.map((r, idx) => {
                      if (r.kind === "user") {
                        return (
                          <Pressable
                            key={`${r.kind}-${r.user_id}-${idx}`}
                            onPress={() => openUser(r.user_id)}
                            style={{
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 16,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: colors.border,
                              backgroundColor: hexToRgba(colors.text, 0.02),
                            }}
                          >
                            <Text
                              style={{ color: colors.text, fontWeight: "900" }}
                              numberOfLines={1}
                            >
                              {r.name || r.email || r.user_id}
                            </Text>
                            <Text
                              style={{
                                color: colors.muted,
                                marginTop: 2,
                                fontWeight: "700",
                              }}
                              numberOfLines={1}
                            >
                              Joined {formatDateShort(r.created_at)}
                              {r.meta ? ` • ${r.meta}` : ""}
                            </Text>
                          </Pressable>
                        );
                      }

                      // workout row
                      return (
                        <Pressable
                          key={`${r.kind}-${r.workout_history_id}-${idx}`}
                          onPress={() => openUser(r.user_id)}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 16,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                            backgroundColor: hexToRgba(colors.text, 0.02),
                          }}
                        >
                          <Text
                            style={{ color: colors.text, fontWeight: "900" }}
                            numberOfLines={1}
                          >
                            {r.workout_title ?? "Workout"} •{" "}
                            {formatDateTimeShort(r.completed_at)}
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              marginTop: 2,
                              fontWeight: "700",
                            }}
                            numberOfLines={1}
                          >
                            {r.name || r.email || r.user_id}
                            {r.meta ? ` • ${r.meta}` : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          {/* User inspector modal */}
          <Modal
            visible={!!selectedUserId}
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedUserId(null)}
          >
            <Pressable
              onPress={() => setSelectedUserId(null)}
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.35)",
                justifyContent: "flex-end",
              }}
            >
              <Pressable
                onPress={() => {}}
                style={{
                  backgroundColor: colors.card,
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 12,
                  minHeight: 380,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: 99,
                    alignSelf: "center",
                    backgroundColor: hexToRgba(colors.text, 0.18),
                    marginBottom: 6,
                  }}
                />

                {summaryLoading ? (
                  <View style={{ paddingVertical: 30, alignItems: "center" }}>
                    <ActivityIndicator />
                  </View>
                ) : !summary?.found ? (
                  <Text style={{ color: colors.muted }}>User not found.</Text>
                ) : (
                  <>
                    <Text
                      style={{
                        fontWeight: "900",
                        fontSize: 18,
                        color: colors.text,
                      }}
                    >
                      {summary.profile?.name ||
                        summary.profile?.email ||
                        "User"}
                    </Text>

                    <Text style={{ color: colors.muted, fontWeight: "700" }}>
                      {summary.profile?.email || "No email"} •{" "}
                      {summary.profile?.role}
                    </Text>

                    <Text
                      style={{
                        color: colors.muted,
                        marginTop: 2,
                        fontWeight: "700",
                      }}
                    >
                      Joined {formatDateShort(summary.profile?.created_at)}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {[
                        ["Workouts", `${summary.stats?.workouts_total ?? 0}`],
                        ["Sets", `${summary.stats?.sets_total ?? 0}`],
                        [
                          "Volume",
                          formatVolume(summary.stats?.total_volume ?? 0),
                        ],
                        ["Streak", `${summary.profile?.weekly_streak ?? 0}`],
                      ].map(([k, v]) => (
                        <View
                          key={k}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 16,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                            backgroundColor: hexToRgba(colors.text, 0.03),
                            minWidth: "48%",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.muted,
                              fontWeight: "800",
                              fontSize: 12,
                            }}
                          >
                            {k}
                          </Text>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "900",
                              fontSize: 18,
                              marginTop: 2,
                            }}
                          >
                            {v}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={{ height: 4 }} />

                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Active plan
                    </Text>
                    <Text style={{ color: colors.muted, fontWeight: "700" }}>
                      {summary.profile?.active_plan_title || "None"}
                    </Text>

                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        marginTop: 6,
                      }}
                    >
                      Most performed (30d)
                    </Text>
                    <Text style={{ color: colors.muted, fontWeight: "700" }}>
                      {summary.stats?.most_performed_exercise_30d || "None"}
                    </Text>

                    <Pressable
                      onPress={() => setSelectedUserId(null)}
                      style={{
                        marginTop: 10,
                        paddingVertical: 12,
                        borderRadius: 16,
                        alignItems: "center",
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>
                        Close
                      </Text>
                    </Pressable>
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
    width: "48%",
  },

  tileLabel: { fontSize: 12, fontWeight: "800" },
  tileValue: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  tileSub: { fontSize: 12, fontWeight: "700", marginTop: 2 },

  fullCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
