import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function DobSheet({
  visible,
  initialDate,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialDate: Date;
  onCancel: () => void;
  onConfirm: (d: Date) => void;
}) {
  const { colors } = useAppTheme() as any; // should match ThemeColors
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tempRef = useRef<Date>(initialDate);

  if (Platform.OS === "android") {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={initialDate}
        mode="date"
        display="default"
        maximumDate={new Date()}
        onChange={(e: DateTimePickerEvent, date?: Date) => {
          if (e.type === "set" && date) onConfirm(date);
          else onCancel();
        }}
      />
    );
  }

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onCancel} />

        <View style={styles.sheet}>
          <View style={styles.toolbar}>
            <View style={styles.sideSlot}>
              <Pressable onPress={onCancel} hitSlop={10}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>

            <View style={styles.centerSlot}>
              <Text style={styles.title} numberOfLines={1}>
                Select Date of Birth
              </Text>
            </View>

            <View style={[styles.sideSlot, styles.sideSlotRight]}>
              <Pressable
                onPress={() => onConfirm(tempRef.current)}
                hitSlop={10}
              >
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
          </View>

          {/* OPAQUE background wrapper is essential on iOS spinner */}
          <View style={styles.pickerBg}>
            <View style={styles.pickerCenter}>
              <DateTimePicker
                value={initialDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_: DateTimePickerEvent, date?: Date) => {
                  if (date) tempRef.current = date;
                }}
                style={styles.picker}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },

    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay ?? "rgba(0,0,0,0.45)",
    },

    sheet: {
      width: "100%",
      backgroundColor: colors.surface, // ✅ tokens
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      overflow: "hidden",
    },

    toolbar: {
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border, // ✅ tokens
      backgroundColor: colors.surface, // ✅ ensure opaque
    },

    sideSlot: { width: 88, justifyContent: "center" },
    sideSlotRight: { alignItems: "flex-end" },
    centerSlot: { flex: 1, alignItems: "center", justifyContent: "center" },

    title: { color: colors.text, fontWeight: "900" },
    cancel: { color: colors.textMuted, fontWeight: "800" }, // ✅ tokens
    done: { color: colors.primary, fontWeight: "900" }, // ✅ tokens

    pickerBg: {
      backgroundColor: colors.surface,
      height: 216, // iOS standard picker height
      justifyContent: "center",
    },

    pickerCenter: {
      alignItems: "center",
      justifyContent: "center",
    },

    picker: {
      width: "100%",
      height: 216,
      transform: [{ translateX: -12 }], // 👈 centers the wheel visually
    },
  });
