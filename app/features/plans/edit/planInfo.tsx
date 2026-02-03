import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useEditPlan } from "./store";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { SafeAreaView } from "react-native-safe-area-context";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PlanInfo() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { title, endDate, setMeta } = useEditPlan();

  /** local edit buffer (for dirty detection) */
  const [localTitle, setLocalTitle] = useState(title);
  const [localEndDate, setLocalEndDate] = useState<string | null>(endDate);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tmpDate, setTmpDate] = useState(
    endDate ? new Date(endDate) : new Date()
  );

  const isDirty =
    localTitle.trim() !== (title ?? "").trim() ||
    localEndDate !== endDate;

  function onSave() {
    setMeta({
      title: localTitle.trim(),
      endDate: localEndDate,
    });
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.container}>
        {/* Card */}
        <View style={s.card}>
          <Text style={s.h2}>Plan Information</Text>
          <Text style={s.sub}>
            Update the core details of your plan.
          </Text>

          {/* Title */}
          <Text style={s.label}>Plan title</Text>
          <TextInput
            value={localTitle}
            onChangeText={setLocalTitle}
            placeholder="e.g. Hypertrophy Block"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />

          {/* End date */}
          <Text style={[s.label, { marginTop: 16 }]}>End date</Text>
          <Pressable
            style={s.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: colors.text }}>
              {localEndDate ? fmtDate(localEndDate) : "Select end date"}
            </Text>
          </Pressable>

          {isDirty && (
            <Text style={s.dirtyHint}>
              Unsaved changes
            </Text>
          )}
        </View>
      </View>

      {/* Sticky footer */}
      <View style={s.footer}>
        <Pressable style={s.footerBtn} onPress={() => router.back()}>
          <Text style={s.footerText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[
            s.footerBtn,
            s.primaryBtn,
            !isDirty && { opacity: 0.5 },
          ]}
          disabled={!isDirty}
          onPress={onSave}
        >
          <Text style={s.primaryText}>Save changes</Text>
        </Pressable>
      </View>

      {/* Date picker */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <Text style={s.h3}>Select end date</Text>

            <DateTimePicker
              value={tmpDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={(_, d) => d && setTmpDate(d)}
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                style={s.footerBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={s.footerText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[s.footerBtn, s.primaryBtn]}
                onPress={() => {
                  const yyyy_mm_dd = new Date(
                    tmpDate.getTime() -
                      tmpDate.getTimezoneOffset() * 60000
                  )
                    .toISOString()
                    .slice(0, 10);

                  setLocalEndDate(yyyy_mm_dd);
                  setShowDatePicker(false);
                }}
              >
                <Text style={s.primaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    h2: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    h3: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    sub: {
      color: colors.textMuted,
      marginBottom: 16,
    },

    label: {
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },

    input: {
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
    },

    dirtyHint: {
      marginTop: 10,
      color: colors.warning,
      fontWeight: "600",
      fontSize: 12,
    },

    footer: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },

    footerBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    footerText: {
      fontWeight: "700",
      color: colors.text,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    primaryText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "800",
    },

    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },

    modalCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
