// app/features/home/prs.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../../../lib/authContext";
import { useAppTheme } from "../../../lib/useAppTheme";
import { supabase } from "../../../lib/supabase";

type PRRow = {
  exercise_id: string;
  exercise_name: string;
  latest_e1rm: number | null;
  latest_day: string | null; // YYYY-MM-DD
  prev_e1rm: number | null;
  pct_change: number | null; // +/- %
};

type SortKey = "alpha" | "movers" | "recent";

export default function PRsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const s = React.useMemo(() => styles(colors), [colors]);

  const [loading, setLoading] = React.useState(true);
  const [allRows, setAllRows] = React.useState<PRRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("alpha");

  React.useEffect(() => {
    if (!userId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      // default lookback = 365; adjust if you want a picker later
      const { data, error } = await supabase.rpc("get_user_pr_summaries", {
        p_user_id: userId,
        p_lookback_days: 365,
      });
      if (error) {
        console.log("get_user_pr_summaries error:", error);
        setAllRows([]);
      } else {
        setAllRows((data as PRRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  // filter + sort
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = allRows;
    if (q) arr = arr.filter((r) => r.exercise_name.toLowerCase().includes(q));

    switch (sortKey) {
      case "movers":
        return [...arr].sort((a, b) => {
          const ap = a.pct_change ?? -Infinity;
          const bp = b.pct_change ?? -Infinity;
          if (bp !== ap) return bp - ap; // biggest positive first
          // tie-breaker: latest first
          return (b.latest_day ?? "").localeCompare(a.latest_day ?? "");
        });
      case "recent":
        return [...arr].sort((a, b) =>
          (b.latest_day ?? "").localeCompare(a.latest_day ?? "")
        );
      case "alpha":
      default:
        return [...arr].sort((a, b) =>
          a.exercise_name.localeCompare(b.exercise_name)
        );
    }
  }, [allRows, query, sortKey]);

  const empty = !loading && filtered.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ paddingHorizontal: 16, paddingBottom: 8 }}
      >
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.link}>← Back</Text>
          </Pressable>
          <Text style={s.header}>Personal Records</Text>
          <View style={{ width: 52 }} />
        </View>

        {/* Search + Sort */}
        <View style={s.controlsRow}>
          <TextInput
            placeholder="Search exercises"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            style={s.input}
          />
          <SortPills sortKey={sortKey} setSortKey={setSortKey} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={[s.center, { paddingTop: 32 }]}>
          <ActivityIndicator />
        </View>
      ) : empty ? (
        <View style={[s.center, { padding: 24 }]}>
          <Text style={s.subtle}>No matching PRs.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            gap: 12,
          }}
          data={filtered}
          keyExtractor={(r) => r.exercise_id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/features/home/prDetail",
                  params: {
                    exerciseId: item.exercise_id,
                    name: item.exercise_name,
                  },
                })
              }
              style={[s.card, { borderColor: colors.border }]}
            >
              <View style={s.rowBetween}>
                {/* LEFT SIDE — exercise info */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.title} numberOfLines={1}>
                    {item.exercise_name}
                  </Text>

                  <Text style={s.subtle}>
                    Latest e1RM:&nbsp;
                    <Text style={s.strong}>{fmtKg(item.latest_e1rm)} kg</Text>
                  </Text>

                  <Text style={[s.subtle, { marginTop: 2 }]}>
                    Updated {niceDate(item.latest_day)}
                  </Text>
                </View>

                {/* RIGHT SIDE — percentage */}
                <View style={s.rightCol}>
                  {item.pct_change != null ? (
                    <Text
                      style={{
                        color: pctColor(item.pct_change, colors),
                        fontWeight: "900",
                        fontSize: 16,
                      }}
                    >
                      {item.pct_change >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(item.pct_change)}%
                    </Text>
                  ) : (
                    <Text style={[s.subtle, { fontWeight: "600" }]}>—</Text>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

/* --- Small sort pills --- */
function SortPills({
  sortKey,
  setSortKey,
}: {
  sortKey: "alpha" | "movers" | "recent";
  setSortKey: (k: "alpha" | "movers" | "recent") => void;
}) {
  const { colors } = useAppTheme();
  const s = React.useMemo(() => styles(colors), [colors]);

  const pills: Array<{ key: typeof sortKey; label: string }> = [
    { key: "alpha", label: "A–Z" },
    { key: "movers", label: "Movers" },
    { key: "recent", label: "Recent" },
  ];

  return (
    <View style={s.pillsRow}>
      {pills.map((p) => {
        const active = sortKey === p.key;
        return (
          <Pressable
            key={p.key}
            onPress={() => setSortKey(p.key)}
            style={[
              s.pill,
              {
                backgroundColor: active ? colors.primaryBg : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: active ? colors.primaryText : colors.text,
                fontWeight: "800",
                fontSize: 12,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- helpers ---------- */
function fmtKg(v: number | null) {
  if (!Number.isFinite(v as number)) return "0.0";
  return Number(v).toFixed(1);
}
function niceDate(isoYYYYMMDD: string | null) {
  if (!isoYYYYMMDD) return "—";
  const d = new Date(isoYYYYMMDD + "T00:00:00");
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return isoYYYYMMDD;
  }
}
function pctColor(pct: number, colors: any) {
  if (pct > 0) return colors.successText; // green
  if (pct < 0) return colors.danger; // red
  return colors.subtle; // flat
}

/* ---------- styles ---------- */
const styles = (colors: any) =>
  StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    link: { color: colors.primaryText, fontWeight: "700", width: 52 },
    header: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      flex: 1,
      textAlign: "center",
    },

    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    pillsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 12,
    },

    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    rightCol: {
      alignItems: "flex-end",
      justifyContent: "center",
      paddingLeft: 10,
      minWidth: 64, // ensures consistent spacing
    },

    title: { color: colors.text, fontWeight: "800", fontSize: 16 },
    subtle: { color: colors.subtle },
    strong: { color: colors.text, fontWeight: "800" },
  });
