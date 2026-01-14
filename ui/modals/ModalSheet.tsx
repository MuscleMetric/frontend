// ui/modals/ModalSheet.tsx
import React, { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  ScrollView,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui";

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;

  title?: string;
  subtitle?: string;

  /**
   * Optional right-side action (e.g. "Edit", "More", etc.)
   * Keep it short.
   */
  rightAction?: {
    label: string;
    onPress: () => void;
    iconName?: string; // uses your <Icon />
  };

  /**
   * If true, content is wrapped in ScrollView automatically.
   * Default: true
   */
  scroll?: boolean;

  /**
   * Allows taller sheets (up to ~92% height).
   * Default: "default"
   */
  heightVariant?: "default" | "tall";

  children: React.ReactNode;
};

export function ModalSheet({
  visible,
  onClose,
  title,
  subtitle,
  rightAction,
  scroll = true,
  heightVariant = "default",
  children,
}: ModalSheetProps) {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(999)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const sheetMaxHeight = useMemo(() => {
    return heightVariant === "tall" ? "92%" : "78%";
  }, [heightVariant]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  };

  const animateOut = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(translateY, {
        toValue: 999,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => cb?.());
  };

  useEffect(() => {
    if (visible) {
      // reset start positions so it never "pops" in
      translateY.setValue(999);
      backdrop.setValue(0);
      animateIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Swipe-down to close
  const pan = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          // only respond to vertical swipe down
          return Math.abs(gesture.dy) > 6 && Math.abs(gesture.dx) < 10 && gesture.dy > 0;
        },
        onPanResponderMove: (_, gesture) => {
          // drag sheet down slightly (clamped)
          const dy = Math.max(0, gesture.dy);
          pan.setValue(dy);
        },
        onPanResponderRelease: (_, gesture) => {
          const dy = Math.max(0, gesture.dy);
          const shouldClose = dy > 90 || gesture.vy > 1.2;

          if (shouldClose) {
            pan.setValue(0);
            animateOut(onClose);
          } else {
            Animated.spring(pan, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
              bounciness: 0,
            }).start();
          }
        },
      }),
    [animateOut, onClose, pan]
  );

  const onRequestClose = () => {
    // Android back button
    animateOut(onClose);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdrop,
            backgroundColor: colors.overlay,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateOut(onClose)} />
      </Animated.View>

      {/* Sheet */}
      <View style={styles.wrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopLeftRadius: layout.radius.xl,
              borderTopRightRadius: layout.radius.xl,
              maxHeight: sheetMaxHeight as any,
              paddingBottom: Math.max(layout.space.lg, insets.bottom + layout.space.sm),
              transform: [
                { translateY },
                {
                  translateY: pan.interpolate({
                    inputRange: [0, 500],
                    outputRange: [0, 500],
                    extrapolate: "clamp",
                  }),
                },
              ],
            },
          ]}
        >
          {/* Drag handle */}
          <View
            {...panResponder.panHandlers}
            style={{ paddingTop: layout.space.sm, paddingBottom: layout.space.sm }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 44,
                height: 5,
                borderRadius: 999,
                backgroundColor:
                  Platform.OS === "ios" ? "rgba(0,0,0,0.18)" : colors.border,
              }}
            />
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: layout.space.lg, paddingBottom: layout.space.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                {title ? (
                  <Text
                    style={{
                      fontFamily: typography.fontFamily.bold,
                      fontSize: typography.size.h2,
                      lineHeight: typography.lineHeight.h2,
                      color: colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                ) : null}

                {subtitle ? (
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: typography.fontFamily.regular,
                      fontSize: typography.size.sub,
                      color: colors.textMuted,
                    }}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              {rightAction ? (
                <Pressable
                  onPress={rightAction.onPress}
                  style={{
                    marginLeft: layout.space.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: layout.radius.pill,
                    backgroundColor: colors.trackBg,
                    borderWidth: 1,
                    borderColor: colors.trackBorder,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {rightAction.iconName ? (
                    <Icon name={rightAction.iconName as any} size={16} color={colors.text} />
                  ) : null}
                  <Text
                    style={{
                      fontFamily: typography.fontFamily.semibold,
                      fontSize: typography.size.meta,
                      color: colors.text,
                    }}
                  >
                    {rightAction.label}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => animateOut(onClose)}
                hitSlop={layout.hitSlop}
                style={{
                  marginLeft: layout.space.sm,
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.trackBg,
                  borderWidth: 1,
                  borderColor: colors.trackBorder,
                }}
              >
                <Icon name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          {scroll ? (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: layout.space.lg,
                paddingBottom: layout.space.lg,
                gap: layout.space.md,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={{
                paddingHorizontal: layout.space.lg,
                paddingBottom: layout.space.lg,
                gap: layout.space.md,
              }}
            >
              {children}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderWidth: 1,
    width: "100%",
    // give it a little lift above bottom on android gesture bars
    paddingTop: 0,
  },
});
