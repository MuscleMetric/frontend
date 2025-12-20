import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Pressable,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../../lib/useAppTheme";
import { useAuth } from "../../lib/useAuth";

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

function formatDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calcAge(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function formatVolume(v?: number | null) {
  const n = typeof v === "number" ? v : 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
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

function MiniBars({
  title,
  values,
  colors,
  maxBars = 30,
}: {
  title: string;
  values: number[];
  colors: any;
  maxBars?: number;
}) {
  const [w, setW] = useState(0);

  const sliced = useMemo(() => {
    if (values.length <= maxBars) return values;
    return values.slice(values.length - maxBars);
  }, [values, maxBars]);

  const max = Math.max(1, ...sliced);
  const gap = 4;

  const barWidth = useMemo(() => {
    if (!w) return 6;
    const n = Math.max(1, sliced.length);
    return Math.max(3, Math.floor((w - gap * (n - 1)) / n));
  }, [w, sliced.length]);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: "900", fontSize: 14, color: colors.text }}>
        {title}
      </Text>

      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ flexDirection: "row", gap, alignItems: "flex-end" }}
      >
        {sliced.map((v, i) => (
          <View
            key={i}
            style={{
              width: barWidth,
              height: Math.max(2, Math.round((v / max) * 52)),
              borderRadius: 6,
              backgroundColor: hexToRgba(colors.text, 0.22),
            }}
          />
        ))}
      </View>
    </View>
  );
}

function StatCard({
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
  const good = "#22c55e";
  const ok = "#f59e0b";
  const bad = "#ef4444";

  const tint =
    status === "good"
      ? good
      : status === "ok"
      ? ok
      : status === "bad"
      ? bad
      : null;

  const borderColor = tint ? hexToRgba(tint, 0.35) : colors.border;
  const bgColor = tint ? hexToRgba(tint, 0.1) : colors.card;

  return (
    <View
      style={[
        styles.kpiCard,
        {
          backgroundColor: bgColor,
          borderColor,
        },
      ]}
    >
      <Text style={[styles.cardLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: colors.text }]}>{value}</Text>
      {!!sub && (
        <Text style={[styles.cardSub, { color: colors.muted }]}>{sub}</Text>
      )}
    </View>
  );
}

function FullCard({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.fullCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}

function AdminTools({ colors }: { colors: any }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AdminUserSearchRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<AdminUserSummary | null>(null);

  async function runSearch() {
    setSearching(true);
    const q = query.trim();

    const { data, error } = await supabase.rpc("admin_search_users", {
      q,
      lim: 10,
    });

    setSearching(false);

    if (error) {
      Alert.alert("Search failed", error.message);
      return;
    }

    setResults((data ?? []) as AdminUserSearchRow[]);
  }

  async function openUser(userId: string) {
    setSelectedUserId(userId);
    setSummary(null);
    setSummaryLoading(true);

    const { data, error } = await supabase.rpc("admin_user_summary", {
      p_user_id: userId,
    });

    setSummaryLoading(false);

    if (error) {
      Alert.alert("Failed to load user", error.message);
      return;
    }

    setSummary(data as AdminUserSummary);
  }

  async function setFlag(flagKey: string, value: boolean) {
    if (!selectedUserId) return;

    const { data, error } = await supabase.rpc("admin_set_user_flag", {
      p_user_id: selectedUserId,
      p_flag_key: flagKey,
      p_value: value,
    });

    if (error) {
      Alert.alert("Failed to update flag", error.message);
      return;
    }

    // Refresh summary quickly
    await openUser(selectedUserId);
  }

  const joined = formatDateShort(summary?.profile?.created_at);
  const age = calcAge(summary?.profile?.date_of_birth);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontWeight: "900", fontSize: 16, color: colors.text }}>
        Admin tools
      </Text>

      {/* Search bar */}
      <View
        style={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users by email or name…"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.text, fontWeight: "700" }}
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

      {/* Results */}
      {results.length === 0 ? (
        <Text style={{ color: colors.muted }}>
          Search to view users. Tip: try your own email.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {results.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => openUser(u.id)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                backgroundColor: hexToRgba(colors.text, 0.03),
              }}
            >
              <Text
                style={{ color: colors.text, fontWeight: "900" }}
                numberOfLines={1}
              >
                {u.name || u.email || u.id}
              </Text>
              <Text
                style={{ color: colors.muted, marginTop: 2 }}
                numberOfLines={1}
              >
                {u.email || "No email"} • {u.role}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* User summary modal */}
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
              minHeight: 320,
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
                  {summary.profile?.name || summary.profile?.email || "User"}
                </Text>

                <Text style={{ color: colors.muted }}>
                  {summary.profile?.email || "No email"} •{" "}
                  {summary.profile?.role}
                </Text>

                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  Joined {formatDateShort(summary?.profile?.created_at)}
                  {calcAge(summary?.profile?.date_of_birth) !== null
                    ? ` • Age ${calcAge(summary?.profile?.date_of_birth)}`
                    : ""}
                </Text>

                {/* Quick stats */}
                <View
                  style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}
                >
                  {[
                    ["Workouts", `${summary.stats?.workouts_total ?? 0}`],
                    ["Sets", `${summary.stats?.sets_total ?? 0}`],
                    ["Volume", formatVolume(summary.stats?.total_volume ?? 0)],
                    ["Streak", `${summary.profile?.weekly_streak ?? 0}`],
                  ].map(([k, v]) => (
                    <View
                      key={k}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 14,
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

                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  Active plan
                </Text>
                <Text style={{ color: colors.muted }}>
                  {summary.profile?.active_plan_title || "None"}
                </Text>

                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 14,
                    color: colors.text,
                    marginTop: 8,
                  }}
                >
                  Most performed (30d)
                </Text>
                <Text style={{ color: colors.muted }}>
                  {summary.stats?.most_performed_exercise_30d || "None"}
                </Text>

                <Pressable
                  onPress={() => setSelectedUserId(null)}
                  style={{
                    marginTop: 10,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
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
    </View>
  );
}

export default function AdminScreen() {
  const { colors } = useAppTheme();
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.rpc("admin_dashboard_v1");

    if (error) {
      setError(error.message);
      setData(null);
      setLoading(false);
      return;
    }

    setData(data as DashboardPayload);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && isAdmin) load();
    if (!authLoading && !isAdmin) setLoading(false);
  }, [authLoading, isAdmin]);

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
        <Text style={{ color: colors.muted }}>Not authorized.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={110} // tweak if needed depending on header height
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16, gap: 14 }}
        >
          {loading ? (
            <View style={[styles.center, { paddingVertical: 24 }]}>
              <View style={{ gap: 6, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "900",
                    color: colors.text,
                    textAlign: "center",
                  }}
                >
                  Platform Overview
                </Text>
                <ActivityIndicator />
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Live snapshot + trends + diagnostics.
                </Text>
              </View>
            </View>
          ) : error ? (
            <FullCard colors={colors}>
              <Text
                style={{
                  fontWeight: "900",
                  color: colors.text,
                  marginBottom: 6,
                }}
              >
                Failed to load
              </Text>
              <Text style={{ color: colors.muted }}>{error}</Text>
            </FullCard>
          ) : data ? (
            <>
              {/* KPI tiles */}
              {(() => {
                const activation = data.kpis.activation_24h_rate;
                const activationStatus =
                  activation >= 0.3
                    ? "good"
                    : activation >= 0.15
                    ? "ok"
                    : "bad";

                const total = Math.max(1, data.kpis.total_users);
                const zeroPct = data.kpis.zero_workouts / total;
                const retention = data.kpis.retention_7d_2plus_rate;

                const zeroStatus =
                  zeroPct < 0.35 ? "good" : zeroPct <= 0.55 ? "ok" : "bad";
                const retentionStatus =
                  retention >= 0.25 ? "good" : retention >= 0.12 ? "ok" : "bad";

                const missing = data.kpis.missing_sets_30d;
                const missingStatus =
                  missing === 0 ? "good" : missing <= 2 ? "ok" : "bad";

                return (
                  <>
                    <View style={styles.grid}>
                      <StatCard
                        label="Total users"
                        value={`${data.kpis.total_users}`}
                        sub="all time"
                        colors={colors}
                        status="neutral"
                      />
                      <StatCard
                        label="New users"
                        value={`${data.kpis.new_1d}`}
                        sub="last 24h"
                        colors={colors}
                        status="neutral"
                      />

                      <StatCard
                        label="New users"
                        value={`${data.kpis.new_7d}`}
                        sub="last 7d"
                        colors={colors}
                        status="neutral"
                      />
                      <StatCard
                        label="Active users"
                        value={`${data.kpis.active_7d}`}
                        sub="last 7d"
                        colors={colors}
                        status="neutral"
                      />

                      <StatCard
                        label="Workouts"
                        value={`${data.kpis.workouts_7d}`}
                        sub="last 7d"
                        colors={colors}
                        status="neutral"
                      />
                      <StatCard
                        label="Sets"
                        value={`${data.kpis.sets_7d}`}
                        sub="last 7d"
                        colors={colors}
                        status="neutral"
                      />

                      <StatCard
                        label="Activation"
                        value={pct(activation)}
                        sub="workout within 24h"
                        colors={colors}
                        status={activationStatus}
                      />
                      <StatCard
                        label="Retention"
                        value={pct(retention)}
                        sub="≥2 workouts in 7d"
                        colors={colors}
                        status={retentionStatus}
                      />
                    </View>

                    {/* Trends */}
                    <FullCard colors={colors}>
                      <MiniBars
                        title="New users (30d)"
                        values={data.trends.new_users_daily.map((x) => x.count)}
                        colors={colors}
                        maxBars={30}
                      />
                      <View style={{ height: 14 }} />
                      <MiniBars
                        title="Active users (12w)"
                        values={data.trends.active_users_weekly.map(
                          (x) => x.active_users
                        )}
                        colors={colors}
                        maxBars={12}
                      />
                    </FullCard>

                    {/* Diagnostics */}
                    <View style={styles.grid}>
                      <StatCard
                        label="0 workouts"
                        value={`${data.kpis.zero_workouts}`}
                        sub={pct(zeroPct)}
                        colors={colors}
                        status={zeroStatus}
                      />
                      <StatCard
                        label="1 workout only"
                        value={`${data.kpis.one_workout}`}
                        sub={
                          data.kpis.total_users
                            ? pct(data.kpis.one_workout / total)
                            : undefined
                        }
                        colors={colors}
                        status="ok"
                      />
                      <StatCard
                        label="Missing sets"
                        value={`${missing}`}
                        sub="workouts w/ no sets (30d)"
                        colors={colors}
                        status={missingStatus}
                      />
                      <StatCard
                        label="Workouts (30d)"
                        value={`${data.kpis.workouts_30d}`}
                        sub="volume of activity"
                        colors={colors}
                        status="neutral"
                      />
                    </View>
                  </>
                );
              })()}

              {/* Content */}
              <FullCard colors={colors}>
                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  Content (30d)
                </Text>

                <View style={{ height: 10 }} />

                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  Top 10 exercises
                </Text>
                {data.content.top_exercises_30d.length === 0 ? (
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    No data yet.
                  </Text>
                ) : (
                  data.content.top_exercises_30d.map((x, i) => (
                    <View
                      key={`${x.name}-${i}`}
                      style={[styles.row, { borderTopColor: colors.border }]}
                    >
                      <Text
                        style={{ color: colors.text, flex: 1 }}
                        numberOfLines={1}
                      >
                        {x.name}
                      </Text>
                      <Text style={{ color: colors.muted }}>{x.count}</Text>
                    </View>
                  ))
                )}

                <View style={{ height: 12 }} />

                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 14,
                    color: colors.text,
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
                      style={[styles.row, { borderTopColor: colors.border }]}
                    >
                      <Text
                        style={{ color: colors.text, flex: 1 }}
                        numberOfLines={1}
                      >
                        {x.equipment}
                      </Text>
                      <Text style={{ color: colors.muted }}>{x.count}</Text>
                    </View>
                  ))
                )}
              </FullCard>

              {/* Admin tools placeholder (versions removed) */}
              <FullCard colors={colors}>
                <AdminTools colors={colors} />
              </FullCard>
            </>
          ) : null}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  kpiCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
    width: "48%",
  },

  fullCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
  },

  cardLabel: { fontSize: 12, fontWeight: "800" },
  cardValue: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  cardSub: { fontSize: 12, fontWeight: "700", marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
