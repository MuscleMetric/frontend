// ui/media/WorkoutCover.tsx
import React from "react";
import {
  ImageBackground,
  Image,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  LayoutChangeEvent,
  useColorScheme,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { resolveWorkoutImage } from "./workoutCovers";

type Variant = "banner" | "tile";

export function WorkoutCover({
  imageKey,
  title,
  subtitle,

  // shared
  radius,
  style,

  // banner options
  height = 170,
  children, // bottom-right slot (legacy)
  badge,
  badgePosition = "bottomRight",
  focusY = 0.5,

  // ✅ new
  variant = "banner",
  tileSize = 56,
  zoom = 1,

  // ✅ NEW: top overlay slots
  topLeft,
  topCenter,
  topRight,
}: {
  imageKey?: string | null;
  title?: string | null;
  subtitle?: string | null;

  radius?: number;
  style?: ViewStyle;

  height?: number;
  children?: React.ReactNode;
  badge?: React.ReactNode;
  badgePosition?: "topLeft" | "topRight" | "bottomRight";
  focusY?: number;

  variant?: Variant;
  tileSize?: number;
  zoom?: number;

  topLeft?: React.ReactNode;
  topCenter?: React.ReactNode;
  topRight?: React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();
  const r = radius ?? (variant === "tile" ? layout.radius.md : layout.radius.lg);

  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const source = React.useMemo(
    () => resolveWorkoutImage(imageKey, { variant, scheme }),
    [imageKey, variant, scheme]
  );

  // TILE MODE ---------------------------------------------------
  if (variant === "tile") {
    return (
      <View
        style={[
          styles.tileWrap,
          {
            width: tileSize,
            height: tileSize,
            borderRadius: r,
            backgroundColor: colors.trackBg,
            borderColor: colors.trackBorder,
          },
          style,
        ]}
      >
        <Image
          source={source}
          style={[
            styles.tileImg,
            {
              borderRadius: r,
              transform: zoom !== 1 ? [{ scale: zoom }] : undefined,
            },
          ]}
        />
      </View>
    );
  }

  // BANNER MODE --------------------------------------------------
  const [w, setW] = React.useState<number>(0);

  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width);
  }, []);

  // Intrinsic size (works for local require() assets)
  const intrinsic = React.useMemo(() => {
    const s = Image.resolveAssetSource(source as any);
    return s?.width && s?.height ? { iw: s.width, ih: s.height } : null;
  }, [source]);

  const translateY = React.useMemo(() => {
    if (!intrinsic || !w || !height) return 0;

    const { iw, ih } = intrinsic;
    const scale = Math.max(w / iw, height / ih);
    const scaledH = ih * scale;
    const extraH = Math.max(0, scaledH - height);
    const desired = (0.5 - focusY) * extraH;
    const maxShift = extraH / 2;
    return Math.max(-maxShift, Math.min(maxShift, desired));
  }, [intrinsic, w, height, focusY]);

  const s = React.useMemo(
    () => makeBannerStyles(colors, typography, layout, height, r),
    [colors, typography, layout, height, r]
  );

  const showTopRow = !!topLeft || !!topCenter || !!topRight;

  return (
    <View onLayout={onLayout} style={[s.bg, style]}>
      <ImageBackground
        source={source}
        style={StyleSheet.absoluteFill}
        imageStyle={[
          s.img,
          {
            transform: [{ translateY }, ...(zoom !== 1 ? [{ scale: zoom }] : [])],
          },
        ]}
      >
        {/* overlay only for banner */}
        <View style={s.overlay} />

        {/* ✅ NEW: top overlay row */}
        {showTopRow ? (
          <View pointerEvents="box-none" style={s.topRow}>
            <View style={s.topSlotLeft}>{topLeft}</View>
            <View style={s.topSlotCenter}>{topCenter}</View>
            <View style={s.topSlotRight}>{topRight}</View>
          </View>
        ) : null}

        {/* Badge */}
        {badge ? (
          <View
            pointerEvents="box-none"
            style={[
              s.badgeWrap,
              badgePosition === "topLeft"
                ? s.badgeTopLeft
                : badgePosition === "topRight"
                ? s.badgeTopRight
                : s.badgeBottomRight,
            ]}
          >
            {badge}
          </View>
        ) : null}

        {/* Bottom content area (title/sub + legacy children bottom-right) */}
        <View style={s.content}>
          <View style={{ flex: 1, gap: 4 }}>
            {!!title ? (
              <Text style={s.title} numberOfLines={2}>
                {title}
              </Text>
            ) : null}

            {!!subtitle ? (
              <Text style={s.sub} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {!!children ? <View style={s.right}>{children}</View> : null}
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  tileWrap: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});

const makeBannerStyles = (
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
      backgroundColor: colors.surface,
    },
    img: {
      borderRadius: radius,
      resizeMode: "cover",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
    },

    // ✅ NEW top row
    topRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      padding: layout.space.md,
      flexDirection: "row",
      alignItems: "center",
      zIndex: 10,
    },
    topSlotLeft: {
      width: 44,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    topSlotCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: layout.space.sm,
    },
    topSlotRight: {
      width: 88,
      alignItems: "flex-end",
      justifyContent: "center",
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
      zIndex: 9,
    },
    badgeTopLeft: {
      top: layout.space.md,
      left: layout.space.md,
    },
    badgeTopRight: {
      top: layout.space.md,
      right: layout.space.md,
    },
    badgeBottomRight: {
      bottom: layout.space.md,
      right: layout.space.md,
    },
  });
