// app/features/workouts/create/auto-create.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppTheme } from "../../../../../../lib/useAppTheme";
import { supabase } from "../../../../../../lib/supabase";
import { useAuth } from "../../../../../../lib/authContext";
import {
  generateWorkout,
  type GenerateWorkoutParams,
  type GeneratedWorkout,
  type TrainingLevel,
  type WorkoutGoal,
  type WorkoutLocation,
  type FocusArea as GeneratorFocusArea,
  type HomeEquipment as GeneratorHomeEquipment,
  type CardioType as GeneratorCardioType,
} from "./workoutGenerator";

// ---- local UI type aliases (using generator ones where possible) ----
type Level = TrainingLevel;
type Goal = WorkoutGoal;
type Location = WorkoutLocation;

// ---- focus areas (UI labels) ----
const FOCUS_AREAS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Glutes",
  "Quads",
  "Hamstrings",
  "Calves",
  "Core",
] as const;

type FocusAreaLabel = (typeof FOCUS_AREAS)[number];

// ---- home equipment options (UI keys) ----
const HOME_EQUIPMENT_OPTIONS = [
  { key: "bodyweight", label: "Bodyweight only" },
  { key: "dumbbells", label: "Dumbbells" },
  { key: "kettlebell", label: "Kettlebell" },
  { key: "resistance_bands", label: "Resistance bands" },
  { key: "pullup_bar", label: "Pull-up bar" },
  { key: "bench", label: "Bench" },
  { key: "stationary_bike", label: "Exercise bike" },
  { key: "treadmill", label: "Treadmill" },
  { key: "rower", label: "Rowing machine" },
  { key: "jump_rope", label: "Jump rope" },
] as const;

type HomeEquipmentKey = (typeof HOME_EQUIPMENT_OPTIONS)[number]["key"];

// ---- cardio options (UI keys, for endurance goal) ----
const CARDIO_OPTIONS = [
  {
    key: "outdoor_run",
    label: "Outdoor run / brisk walk",
    requires: [] as string[],
  },
  {
    key: "treadmill",
    label: "Treadmill",
    requires: ["treadmill"],
  },
  {
    key: "cycling",
    label: "Bike / spin bike",
    requires: ["stationary_bike"],
  },
  {
    key: "rowing",
    label: "Rowing machine",
    requires: ["rower"],
  },
  {
    key: "jump_rope",
    label: "Jump rope",
    requires: ["jump_rope"],
  },
  {
    key: "circuits",
    label: "Bodyweight circuits",
    requires: [],
  },
] as const;

type CardioKey = (typeof CARDIO_OPTIONS)[number]["key"];

/* ---------- mapping helpers (UI -> generator types) ---------- */

const HOME_EQUIPMENT_WHITELIST: GeneratorHomeEquipment[] = [
  "bodyweight",
  "dumbbells",
  "kettlebell",
  "resistance_bands",
  "pullup_bar",
  "bench",
];

function mapFocusAreasToGenerator(
  labels: FocusAreaLabel[]
): GeneratorFocusArea[] {
  const set = new Set<GeneratorFocusArea>();

  labels.forEach((label) => {
    switch (label) {
      case "Chest":
        set.add("chest");
        break;
      case "Back":
        set.add("back");
        break;
      case "Shoulders":
        set.add("shoulders");
        break;
      case "Biceps":
        set.add("biceps");
        break;
      case "Triceps":
        set.add("triceps");
        break;
      case "Core":
        set.add("core");
        break;
      // All lower-body labels map to one generator bucket: "legs"
      case "Glutes":
      case "Quads":
      case "Hamstrings":
      case "Calves":
        set.add("legs");
        break;
    }
  });

  return Array.from(set);
}

function mapHomeEquipmentToGenerator(
  keys: HomeEquipmentKey[]
): GeneratorHomeEquipment[] {
  // Only return the subset the generator actually understands
  return HOME_EQUIPMENT_WHITELIST.filter((whKey) =>
    keys.includes(whKey as HomeEquipmentKey)
  );
}

function mapCardioTypesToGenerator(
  keys: CardioKey[]
): GeneratorCardioType[] {
  const set = new Set<GeneratorCardioType>();

  keys.forEach((key) => {
    switch (key) {
      case "outdoor_run":
      case "treadmill":
        set.add("running");
        break;
      case "cycling":
        set.add("cycling");
        break;
      case "rowing":
        set.add("rowing");
        break;
      case "jump_rope":
        set.add("skipping");
        break;
      case "circuits":
        set.add("hiit_circuits");
        break;
    }
  });

  return Array.from(set);
}

/* ---------- Screen component ---------- */

type SessionLength = 30 | 45 | 60;

export default function AutoCreateWorkout() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [level, setLevel] = useState<Level>("beginner");
  const [primaryGoal, setPrimaryGoal] = useState<Goal>("build_muscle");
  const [location, setLocation] = useState<Location>("gym");
  const [sessionLength, setSessionLength] = useState<SessionLength>(45);

  const [focusAreas, setFocusAreas] = useState<FocusAreaLabel[]>([]);
  const [homeEquipment, setHomeEquipment] = useState<HomeEquipmentKey[]>([]);
  const [cardioTypes, setCardioTypes] = useState<CardioKey[]>([]);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isEndurance = primaryGoal === "improve_endurance";

  // Cardio options available given location + home equipment
  const availableCardioOptions = useMemo(() => {
    if (location === "gym" || location === "both") {
      // At the gym we allow everything
      return CARDIO_OPTIONS;
    }

    // Home: filter by equipment
    return CARDIO_OPTIONS.filter((opt) => {
      if (!opt.requires || opt.requires.length === 0) return true; // outdoor / circuits
      return opt.requires.some((req) =>
        homeEquipment.includes(req as HomeEquipmentKey)
      );
    });
  }, [location, homeEquipment]);

  // Prefill from profile.settings if available
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingProfile(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("settings")
          .eq("id", userId)
          .single();

        if (error || !data?.settings || cancelled) return;

        const s = data.settings as any;

        if (s.level) setLevel(s.level);
        if (s.primaryGoal) setPrimaryGoal(s.primaryGoal);
      } catch (e) {
        console.warn("Failed to load profile settings for auto-create:", e);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Reset home equipment when leaving "home"
  useEffect(() => {
    if (location !== "home" && homeEquipment.length) {
      setHomeEquipment([]);
    }
  }, [location, homeEquipment.length]);

  function toggleFocusArea(area: FocusAreaLabel) {
    setFocusAreas((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : prev.length >= 3
        ? prev // max 3
        : [...prev, area]
    );
  }

  function toggleHomeEquipment(key: HomeEquipmentKey) {
    setHomeEquipment((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleCardioType(key: CardioKey) {
    setCardioTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const handleGeneratePress = async () => {
    if (!userId) {
      Alert.alert(
        "Sign in again",
        "We lost your session – please sign in to generate a workout."
      );
      router.replace("/(auth)/login");
      return;
    }

    // Validation – same as before
    if (!isEndurance) {
      if (focusAreas.length === 0) {
        Alert.alert(
          "Choose a focus",
          "Pick at least one area you want this workout to emphasise."
        );
        return;
      }
    } else {
      if (availableCardioOptions.length === 0) {
        Alert.alert(
          "No cardio options",
          "Based on your home equipment there are no supported cardio types yet. Try adding 'Bodyweight only' or selecting gym."
        );
        return;
      }
      if (cardioTypes.length === 0) {
        Alert.alert(
          "Choose cardio",
          "Pick at least one type of cardio you enjoy."
        );
        return;
      }
    }

    const params: GenerateWorkoutParams = {
      level,
      primaryGoal,
      location,
      sessionLengthMin: sessionLength,
      focusAreas: mapFocusAreasToGenerator(focusAreas),
      homeEquipment: mapHomeEquipmentToGenerator(homeEquipment),
      cardioTypes: mapCardioTypesToGenerator(cardioTypes),
    };

    console.log("AUTO-WORKOUT INPUT", {
      userId,
      ...params,
    });

    try {
      setGenerating(true);
      const workout: GeneratedWorkout = await generateWorkout(params);
      console.log("AUTO-WORKOUT GENERATED", workout);

      // Navigate to review screen with the workout JSON
      router.push({
        pathname: "/features/workouts/create/auto-review",
        params: {
          workout: JSON.stringify(workout),
        },
      });
    } catch (e) {
      console.warn("generateWorkout failed", e);
      Alert.alert(
        "Generation failed",
        "Something went wrong while generating your workout. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Generate a Workout</Text>
        <Text style={styles.subtitle}>
          Answer a few quick questions and we’ll create a workout tailored to
          you.
        </Text>

        {/* Level */}
        <Section label="Current Fitness Level">
          <ChipColumn>
            <LevelCard
              label="Beginner"
              description="New to training or back after a break."
              active={level === "beginner"}
              onPress={() => setLevel("beginner")}
            />
            <LevelCard
              label="Intermediate"
              description="Training consistently 6–24 months."
              active={level === "intermediate"}
              onPress={() => setLevel("intermediate")}
            />
            <LevelCard
              label="Advanced"
              description="Training hard for 2+ years."
              active={level === "advanced"}
              onPress={() => setLevel("advanced")}
            />
          </ChipColumn>
        </Section>

        {/* Goal */}
        <Section label="Goal for this workout">
          <ChipColumn>
            <LevelCard
              label="Build Muscle"
              description="Add size and shape to your physique."
              active={primaryGoal === "build_muscle"}
              onPress={() => setPrimaryGoal("build_muscle")}
            />
            <LevelCard
              label="Lose Fat"
              description="Reduce body fat and look leaner."
              active={primaryGoal === "lose_fat"}
              onPress={() => setPrimaryGoal("lose_fat")}
            />
            <LevelCard
              label="Get Stronger"
              description="Focus on performance and heavy lifts."
              active={primaryGoal === "get_stronger"}
              onPress={() => setPrimaryGoal("get_stronger")}
            />
            <LevelCard
              label="Improve Endurance"
              description="Improve your engine and overall fitness."
              active={primaryGoal === "improve_endurance"}
              onPress={() => setPrimaryGoal("improve_endurance")}
            />
          </ChipColumn>
        </Section>

        {/* Location */}
        <Section label="Where will you train?">
          <View style={styles.row}>
            {(["gym", "home", "both"] as Location[]).map((loc) => {
              const label =
                loc === "gym" ? "Gym" : loc === "home" ? "Home" : "Both";
              const active = location === loc;
              return (
                <Pressable
                  key={loc}
                  style={[
                    styles.chip,
                    active && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setLocation(loc)}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: active ? "#fff" : colors.text,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Home equipment (only if training at home) */}
        {location === "home" && (
          <Section label="What equipment do you have at home?">
            <Text style={styles.helper}>Pick all that apply.</Text>
            <View style={styles.wrapRow}>
              {HOME_EQUIPMENT_OPTIONS.map((opt) => {
                const active = homeEquipment.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => toggleHomeEquipment(opt.key)}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: active ? "#fff" : colors.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {/* Session length */}
        <Section label="How long should this workout take?">
          <View style={styles.row}>
            {[30, 45, 60].map((len) => {
              const active = sessionLength === len;
              return (
                <Pressable
                  key={len}
                  style={[
                    styles.chip,
                    active && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSessionLength(len as SessionLength)}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: active ? "#fff" : colors.text,
                    }}
                  >
                    {len} mins
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Focus areas OR Cardio type depending on goal */}
        {!isEndurance && (
          <Section label="Which areas should this workout emphasise?">
            <Text style={styles.helper}>
              Pick up to 3. We’ll still keep the workout balanced.
            </Text>
            <View style={styles.wrapRow}>
              {FOCUS_AREAS.map((area) => {
                const active = focusAreas.includes(area);
                return (
                  <Pressable
                    key={area}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => toggleFocusArea(area)}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: active ? "#fff" : colors.text,
                      }}
                    >
                      {area}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {isEndurance && (
          <Section label="What type of cardio do you enjoy?">
            <Text style={styles.helper}>
              We’ll build the session around what you actually like doing.
            </Text>
            <View style={styles.wrapRow}>
              {availableCardioOptions.map((opt) => {
                const active = cardioTypes.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => toggleCardioType(opt.key)}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: active ? "#fff" : colors.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => router.back()}
          >
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              styles.btnPrimary,
              (loadingProfile || generating) && { opacity: 0.7 },
            ]}
            onPress={handleGeneratePress}
            disabled={loadingProfile || generating}
          >
            <Text style={styles.btnPrimaryText}>
              {loadingProfile
                ? "Loading…"
                : generating
                ? "Generating…"
                : "Generate Workout"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* --- tiny layout helpers --- */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontWeight: "800",
          fontSize: 16,
          marginBottom: 8,
          color: colors.text,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function ChipColumn({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 10 }}>{children}</View>;
}

function LevelCard({
  label,
  description,
  active,
  onPress,
}: {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: 16,
          padding: 14,
          marginBottom: 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        active && {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
      ]}
    >
      <Text
        style={{
          fontWeight: "800",
          color: active ? "#fff" : colors.text,
          fontSize: 16,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 13,
          color: active ? "rgba(255,255,255,0.9)" : colors.subtle,
        }}
      >
        {description}
      </Text>
    </Pressable>
  );
}

/* --- styles --- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      padding: 16,
      paddingBottom: 32,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      color: colors.subtle,
      marginBottom: 16,
      fontSize: 14,
    },
    row: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    wrapRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    helper: {
      color: colors.subtle,
      marginBottom: 6,
      fontSize: 12,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
      marginBottom: 8,
    },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnPrimaryText: {
      color: "#fff",
      fontWeight: "700",
    },
    btnGhost: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    btnGhostText: {
      color: colors.text,
      fontWeight: "700",
    },
  });
