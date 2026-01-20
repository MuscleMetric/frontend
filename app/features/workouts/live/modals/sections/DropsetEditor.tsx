// live/modals/sections/DropsetEditor.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
} from "react-native";
import {
  clampInt,
  sanitizeRepsInput,
  sanitizeWeightInput,
} from "../helpers/inputSanitizers";

export function DropsetEditor(props: {
  colors: any;
  typography: any;
  dropRows: Array<{
    setNumber: number;
    dropIndex: number;
    reps: number | null;
    weight: number | null;
  }>;
  onUpdateDrop: (args: {
    dropIndex: number;
    field: "reps" | "weight";
    value: number | null;
  }) => void;
  onAddDrop: () => void;
  canRemoveDrop?: boolean;
  onRemoveDrop?: () => void;
}) {
  const { colors, typography, dropRows, canRemoveDrop, onRemoveDrop } = props;

  // small quality: “Drop 1, Drop 2…” stable order
  const sorted = useMemo(
    () => dropRows.slice().sort((a, b) => a.dropIndex - b.dropIndex),
    [dropRows]
  );

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      {/* Title row + actions */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.size.body,
          }}
        >
          Drops
        </Text>

        {canRemoveDrop ? (
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              onRemoveDrop?.();
            }}
            hitSlop={10}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface ?? colors.bg,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fontFamily.semibold,
                fontSize: typography.size.sub,
              }}
            >
              − Remove drop
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Scrollable list of drop cards */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 260 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
      >
        {sorted.map((dr) => (
          <Pressable
            key={`${dr.setNumber}-${dr.dropIndex}`}
            onPress={() => Keyboard.dismiss()}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface ?? colors.bg,
              borderRadius: 20,
              padding: 14,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.fontFamily.semibold,
                fontSize: typography.size.sub,
                marginBottom: 10,
              }}
            >
              DROP {dr.dropIndex}
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              {/* Weight */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  WEIGHT (KG)
                </Text>

                <TextInput
                  value={dr.weight != null ? String(dr.weight) : ""}
                  onChangeText={(t) => {
                    const s = sanitizeWeightInput(t);

                    if (!s || s === "." || s === "0" || s === "0.") {
                      props.onUpdateDrop({
                        dropIndex: dr.dropIndex,
                        field: "weight",
                        value: null,
                      });
                      return;
                    }

                    const n = Number(s);
                    const v = Number.isFinite(n)
                      ? Math.max(0, Math.round(n * 100) / 100)
                      : null;

                    props.onUpdateDrop({
                      dropIndex: dr.dropIndex,
                      field: "weight",
                      value: v,
                    });
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType={Platform.OS === "ios" ? "default" : "numeric"}
                  inputMode="decimal"
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={{
                    marginTop: 6,
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 22,
                    color: colors.text,
                    paddingVertical: 6,
                  }}
                />
              </View>

              {/* Reps */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  REPS
                </Text>

                <TextInput
                  value={dr.reps != null ? String(dr.reps) : ""}
                  onChangeText={(t) => {
                    const s = sanitizeRepsInput(t);
                    const v =
                      !s || s === "0" ? null : clampInt(Number(s), 0, 300);

                    props.onUpdateDrop({
                      dropIndex: dr.dropIndex,
                      field: "reps",
                      value: v,
                    });
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={{
                    marginTop: 6,
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 22,
                    color: colors.text,
                    paddingVertical: 6,
                  }}
                />
              </View>
            </View>
          </Pressable>
        ))}

        {/* Add drop */}
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            props.onAddDrop();
          }}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: "dashed",
            borderRadius: 20,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.semibold,
            }}
          >
            + Add Drop
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
