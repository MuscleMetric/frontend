import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export type CreatedExercise = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;

  // use same theme object you already pass around
  colors: {
    background: string;
    surface: string;
    card: string;
    text: string;
    subtle: string;
    border: string;
    primary: string;
    primaryBg?: string;
    primaryText?: string;
    danger?: string;
  };
  safeAreaTop: number;

  // data you already have in picker
  equipmentOptions: string[];

  onCreated: (ex: CreatedExercise) => void;
};

const capFirst = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

export default function CreateExerciseModal({
  visible,
  onClose,
  userId,
  colors,
  safeAreaTop,
  equipmentOptions,
  onCreated,
}: Props) {
  const S = useMemo(() => local(colors), [colors]);

  const [name, setName] = useState("");
  const [type, setType] = useState<"strength" | "cardio">("strength");
  const [equipment, setEquipment] = useState<string>("bodyweight");
  const [saving, setSaving] = useState(false);

  // reset when opened
  React.useEffect(() => {
    if (!visible) return;
    setName("");
    setType("strength");
    setEquipment("bodyweight");
    setSaving(false);
  }, [visible]);

  const canSave = name.trim().length >= 2 && !saving;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert("Name too short", "Exercise name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      // IMPORTANT:
      // This assumes your exercises table has columns:
      // id (uuid), name, type, equipment, user_id, is_public
      // and RLS allows inserting (user_id = auth.uid()) and is_public=false.
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          name: trimmed,
          type,
          equipment: (equipment || "").toLowerCase(),
          user_id: userId,
          is_public: false,
        })
        .select("id,name,type,equipment")
        .single();

      if (error) throw error;

      onCreated({
        id: String(data.id),
        name: data.name ?? null,
        type: data.type ?? null,
        equipment: data.equipment ?? null,
      });
    } catch (e: any) {
      console.warn("create exercise failed", e);
      Alert.alert(
        "Couldn’t create exercise",
        e?.message || "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[S.safe, { paddingTop: safeAreaTop }]}>
        {/* Header */}
        <View style={S.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[S.headerBtn, { color: colors.primary }]}>Cancel</Text>
          </Pressable>

          <Text style={S.title}>Create Exercise</Text>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            hitSlop={10}
            style={{ opacity: canSave ? 1 : 0.4 }}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={[S.headerBtn, { color: colors.primary }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <View style={S.body}>
          {/* Name */}
          <Text style={S.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Seated Cable Row (Wide)"
            placeholderTextColor={colors.subtle}
            style={S.input}
            autoCapitalize="words"
            returnKeyType="done"
          />

          {/* Type */}
          <Text style={[S.label, { marginTop: 14 }]}>Type</Text>
          <View style={S.row}>
            <Pressable
              onPress={() => setType("strength")}
              style={[
                S.pill,
                type === "strength" && {
                  backgroundColor: colors.primaryBg ?? colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  S.pillText,
                  type === "strength" && { color: colors.primaryText ?? "#fff" },
                ]}
              >
                Strength
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setType("cardio")}
              style={[
                S.pill,
                type === "cardio" && {
                  backgroundColor: colors.primaryBg ?? colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  S.pillText,
                  type === "cardio" && { color: colors.primaryText ?? "#fff" },
                ]}
              >
                Cardio
              </Text>
            </Pressable>
          </View>

          {/* Equipment */}
          <Text style={[S.label, { marginTop: 14 }]}>Equipment</Text>
          <View style={S.eqWrap}>
            {equipmentOptions.map((eq) => {
              const active = equipment === eq;
              return (
                <Pressable
                  key={eq}
                  onPress={() => setEquipment(eq)}
                  style={[
                    S.eqChip,
                    active && {
                      backgroundColor: colors.primaryBg ?? colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.eqChipText,
                      active && { color: colors.primaryText ?? "#fff", fontWeight: "800" },
                    ]}
                  >
                    {capFirst(eq)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={S.hint}>
            Custom exercises are private by default and will appear in your list.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const local = (colors: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 16,
    },
    headerBtn: {
      fontWeight: "900",
      fontSize: 14,
    },
    body: {
      padding: 16,
    },
    label: {
      color: colors.text,
      fontWeight: "800",
      marginBottom: 8,
      fontSize: 13,
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    row: {
      flexDirection: "row",
      gap: 10,
    },
    pill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    pillText: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 13,
    },
    eqWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      paddingTop: 4,
    },
    eqChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    eqChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    hint: {
      marginTop: 14,
      color: colors.subtle,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
    },
  });
