import React, { useMemo, useRef } from "react";
import { View, Text, Modal, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
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
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const tempRef = useRef<Date>(initialDate);

  // Android: show native picker only while visible
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
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />

      <View style={styles.sheet}>
        <View style={styles.toolbar}>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>

          <Text style={styles.title}>Select Date of Birth</Text>

          <Pressable onPress={() => onConfirm(tempRef.current)} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <DateTimePicker
          value={initialDate}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          onChange={(_: DateTimePickerEvent, date?: Date) => {
            if (date) tempRef.current = date;
          }}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      overflow: "hidden",
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontWeight: "900",
    },
    cancel: {
      color: colors.subtle,
      fontWeight: "800",
    },
    done: {
      color: colors.primary,
      fontWeight: "900",
    },
  });
