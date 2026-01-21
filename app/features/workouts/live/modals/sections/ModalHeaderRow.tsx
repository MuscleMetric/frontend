// live/modals/sections/ModalHeaderRow.tsx
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Keyboard, Modal } from "react-native";

export function ModalHeaderRow(props: {
  colors: any;
  typography: any;
  title: string;
  subtitle: string;
  onClose: () => void;

  // menu actions
  showMenu?: boolean; // default true
  canDropset?: boolean; // parent decides (e.g. !cardio)
  dropsetEnabled?: boolean; // current state for exercise
  onToggleDropset?: () => void;

  onSwapExercise?: () => void;
}) {
  const { colors, typography } = props;
  const [menuOpen, setMenuOpen] = useState(false);

  const rightLabel = useMemo(() => {
    if (props.showMenu === false) return "";
    return "⋯";
  }, [props.showMenu]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function actionPress(fn?: () => void) {
    Keyboard.dismiss();
    closeMenu();

    // iOS: don't try to open another Modal until this one is fully dismissed
    setTimeout(() => {
      fn?.();
    }, 250);
  }

  const sheetRadius = 18;

  return (
    <>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            props.onClose();
          }}
          hitSlop={12}
          style={{ width: 70 }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.semibold,
            }}
          >
            Close
          </Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: typography.size.h3,
              color: colors.text,
              letterSpacing: -0.2,
              textAlign: "center",
            }}
            numberOfLines={2}
          >
            {props.title}
          </Text>

          <Text
            style={{
              color: colors.textMuted,
              marginTop: 3,
              fontSize: typography.size.sub,
            }}
          >
            {props.subtitle}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (props.showMenu === false) return;
            Keyboard.dismiss();
            setMenuOpen(true);
          }}
          hitSlop={12}
          style={{
            width: 70,
            alignItems: "flex-end",
            opacity: props.showMenu === false ? 0 : 1,
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.semibold,
              fontSize: 22,
              lineHeight: 22,
            }}
          >
            {rightLabel}
          </Text>
        </Pressable>
      </View>

      {/* Action sheet */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        {/* Backdrop */}
        <Pressable
          onPress={closeMenu}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
        />

        {/* Sheet */}
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 18,
          }}
        >
          <View
            style={{
              alignItems: "center",
              paddingBottom: 10,
            }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 99,
                backgroundColor: colors.border,
                opacity: 0.9,
              }}
            />
          </View>

          {/* Swap */}
          <Pressable
            onPress={() => actionPress(props.onSwapExercise)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface ?? colors.bg,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 14,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fontFamily.semibold,
                fontSize: 15,
              }}
            >
              Swap exercise
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                marginTop: 4,
                fontSize: typography.size.sub,
              }}
            >
              Replace this exercise with another.
            </Text>
          </Pressable>

          {/* Dropset toggle */}
          {props.canDropset ? (
            <Pressable
              onPress={() => actionPress(props.onToggleDropset)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface ?? colors.bg,
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.semibold,
                    fontSize: 15,
                  }}
                >
                  Dropset
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    marginTop: 4,
                    fontSize: typography.size.sub,
                  }}
                >
                  {props.dropsetEnabled ? "Enabled" : "Disabled"} for this
                  exercise.
                </Text>
              </View>

              <View
                style={{
                  width: 46,
                  height: 28,
                  borderRadius: 999,
                  padding: 3,
                  backgroundColor: props.dropsetEnabled
                    ? colors.primary
                    : colors.border,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    alignSelf: props.dropsetEnabled ? "flex-end" : "flex-start",
                  }}
                />
              </View>
            </Pressable>
          ) : null}

          {/* Cancel */}
          <Pressable
            onPress={closeMenu}
            style={{
              marginTop: 12,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.fontFamily.semibold,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
