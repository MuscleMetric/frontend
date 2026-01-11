import React from "react";
import {
  ImageBackground,
  Image,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  LayoutChangeEvent,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { resolveWorkoutCover } from "./workoutCovers";

export function WorkoutCover({
  imageKey,
  title,
  subtitle,
  height = 170,
  radius,
  style,
  children,
  badge,
  badgePosition = "bottomRight",
  focusY = 0.5, // 0 = top, 0.5 = center, 1 = bottom
}: {
  imageKey?: string | null;
  title?: string | null;
  subtitle?: string | null;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
  badge?: React.ReactNode;
  badgePosition?: "topLeft" | "bottomRight";
  focusY?: number;
}) {
  const { colors, typography, layout } = useAppTheme();
  const r = radius ?? layout.radius.lg;

  const source = React.useMemo(() => resolveWorkoutCover(imageKey), [imageKey]);

  const [w, setW] = React.useState<number>(0);

  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width);
  }, []);

  // Get intrinsic image size (works for local require() assets)
  const intrinsic = React.useMemo(() => {
    const s = Image.resolveAssetSource(source as any);
    return s?.width && s?.height ? { iw: s.width, ih: s.height } : null;
  }, [source]);

  // Compute the translateY that changes the crop focus, but NEVER shows blank space.
  const translateY = React.useMemo(() => {
    if (!intrinsic || !w || !height) return 0;

    const { iw, ih } = intrinsic;

    // cover scaling for this container (w x height)
    const scale = Math.max(w / iw, height / ih);
    const scaledH = ih * scale;

    const extraH = Math.max(0, scaledH - height); // how much vertical "slack" we can move through
    // focusY=0 -> show top -> image pushed DOWN by extraH/2
    // focusY=1 -> show bottom -> image pushed UP by extraH/2
    const desired = (0.5 - focusY) * extraH;

    // Clamp so we never reveal empty background
    const maxShift = extraH / 2;
    return Math.max(-maxShift, Math.min(maxShift, desired));
  }, [intrinsic, w, height, focusY]);

  const styles = React.useMemo(
    () => makeStyles(colors, typography, layout, height, r),
    [colors, typography, layout, height, r]
  );

  return (
    <View onLayout={onLayout} style={[styles.bg, style]}>
      <ImageBackground
        source={source}
        style={StyleSheet.absoluteFill}
        imageStyle={[
          styles.img,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.overlay} />

        {/* ✅ badge layer (above overlay + image) */}
        {badge ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.badgeWrap,
              badgePosition === "topLeft"
                ? styles.badgeTopLeft
                : styles.badgeBottomRight,
            ]}
          >
            {badge}
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={{ flex: 1, gap: 4 }}>
            {!!title ? (
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            ) : null}

            {!!subtitle ? (
              <Text style={styles.sub} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {!!children ? <View style={styles.right}>{children}</View> : null}
        </View>
      </ImageBackground>
    </View>
  );
}

const makeStyles = (
  colors: any,
  typography: any,
  layout: any,
  height: number,
  radius: number
) =>
  StyleSheet.create({
    bg: {
      height,
      borderRadius: radius,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    img: {
      borderRadius: radius,
      resizeMode: "cover",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.40)",
    },
    content: {
      flex: 1,
      padding: layout.space.md,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: layout.space.md,
    },
    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h3 ?? typography.size.h2,
      color: "#fff",
      letterSpacing: -0.3,
    },
    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: "rgba(255,255,255,0.85)",
    },
    right: {
      alignSelf: "flex-end",
    },

    badgeWrap: {
      position: "absolute",
      zIndex: 5,
    },
    badgeTopLeft: {
      top: layout.space.md,
      left: layout.space.md,
    },
    badgeBottomRight: {
      bottom: layout.space.md,
      right: layout.space.md,
    },
  });
