import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { useColorScheme } from "react-native";
import { supabase } from "../../lib/supabase";

export function SplashScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // After 7s, show fallback UI
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 7000);
    return () => clearTimeout(t);
  }, []);

  async function retry() {
    try {
      setRetrying(true);
      await supabase.auth.getSession();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0B0B0B" : "#FFFFFF" },
      ]}
    >
      {/* App name / logo */}
      <Text
        style={[
          styles.title,
          { color: isDark ? "#FFFFFF" : "#111111" },
        ]}
      >
        MuscleMetric
      </Text>

      <ActivityIndicator size="large" />

      <Text
        style={[
          styles.subtitle,
          { color: isDark ? "#AAAAAA" : "#666666" },
        ]}
      >
        Loading your training data…
      </Text>

      {slow && (
        <View style={styles.slowBox}>
          <Text
            style={[
              styles.slowText,
              { color: isDark ? "#CCCCCC" : "#444444" },
            ]}
          >
            This is taking longer than usual.
          </Text>

          <Pressable
            onPress={retry}
            disabled={retrying}
            style={[
              styles.retryBtn,
              { opacity: retrying ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.retryText}>
              {retrying ? "Retrying…" : "Try again"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 16,
    fontSize: 14,
  },
  slowBox: {
    marginTop: 32,
    alignItems: "center",
  },
  slowText: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  retryText: {
    color: "white",
    fontWeight: "700",
  },
});
