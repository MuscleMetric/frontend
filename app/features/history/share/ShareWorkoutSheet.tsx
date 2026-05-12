import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import ViewShot from "react-native-view-shot";
import { useAppTheme } from "@/lib/useAppTheme";
import { ModalSheet, Button, Icon } from "@/ui";

import type { ShareTemplateId, ShareWorkoutData } from "./workoutShare";
import { sharePng } from "./workoutShare";
import { WorkoutShareCard } from "./WorkoutShareCard";

const TEMPLATES: { id: ShareTemplateId; label: string; subtitle: string }[] = [
  {
    id: "black",
    label: "Black",
    subtitle: "Clean story card",
  },
  {
    id: "transparent",
    label: "Transparent",
    subtitle: "Best over photos or videos",
  },
];

function clamp(n: number, min: number, max: number) {
  "worklet";
  return Math.max(min, Math.min(max, n));
}

export function ShareWorkoutSheet({
  visible,
  onClose,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  data: ShareWorkoutData;
  shareUrl?: string | null;
}) {
  const { colors, typography } = useAppTheme();

  const CAPTURE_W = 1080;
  const CAPTURE_H = 1920;

  const PREVIEW_W = 270;
  const PREVIEW_H = 480;
  const PAGE_GAP = 12;

  const [pageIndex, setPageIndex] = useState(0);
  const [template, setTemplate] = useState<ShareTemplateId>("black");

  const [previewUris, setPreviewUris] = useState<
    Record<ShareTemplateId, string | null>
  >({
    black: null,
    transparent: null,
  });

  const [previewLoading, setPreviewLoading] = useState(false);

  const shotRef = useRef<ViewShot>(null);

  const currentTemplate = TEMPLATES[pageIndex] ?? TEMPLATES[0];

  useEffect(() => {
    setTemplate(currentTemplate.id);
  }, [currentTemplate.id]);

  async function capturePng() {
    const uri = await shotRef.current?.capture?.();
    if (!uri) throw new Error("Failed to capture share image");
    return uri;
  }

  useEffect(() => {
    let alive = true;

    async function buildAllPreviews() {
      if (!visible) return;

      setPreviewLoading(true);

      try {
        if (alive) {
          setPreviewUris({
            black: null,
            transparent: null,
          });
        }

        for (const t of TEMPLATES) {
          if (!alive) return;

          setTemplate(t.id);
          await new Promise((r) => setTimeout(r, 80));

          const uri = await capturePng();

          if (alive) {
            setPreviewUris((prev) => ({
              ...prev,
              [t.id]: uri,
            }));
          }
        }

        if (alive) {
          setTemplate(currentTemplate.id);
        }
      } catch (e) {
        console.warn("Share preview build failed:", e);
      } finally {
        if (alive) setPreviewLoading(false);
      }
    }

    buildAllPreviews();

    return () => {
      alive = false;
    };
  }, [visible, data]);

  function onPagerEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const next = clamp(
      Math.round(x / (PREVIEW_W + PAGE_GAP)),
      0,
      TEMPLATES.length - 1,
    );

    setPageIndex(next);
  }

  async function onShareMore() {
    try {
      const current = currentTemplate.id;

      if (template !== current) {
        setTemplate(current);
      }

      await new Promise((r) => setTimeout(r, 60));

      const uri = await capturePng();
      await sharePng(uri);
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Unknown error");
    }
  }

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Share Workout">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: 16,
              color: colors.text,
            }}
          >
            {currentTemplate.label}
          </Text>

          <Text
            style={{
              marginTop: 4,
              color: colors.textMuted,
              fontSize: 12,
              fontFamily: typography.fontFamily.medium,
            }}
          >
            {previewLoading
              ? "Building preview…"
              : currentTemplate.subtitle}
          </Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPagerEnd}
            decelerationRate="fast"
            snapToInterval={PREVIEW_W + PAGE_GAP}
            snapToAlignment="center"
            contentContainerStyle={{ paddingHorizontal: 2 }}
          >
            {TEMPLATES.map((t, i) => {
              const uri = previewUris[t.id];
              const active = i === pageIndex;

              return (
                <View
                  key={t.id}
                  style={{
                    width: PREVIEW_W,
                    height: PREVIEW_H,
                    borderRadius: 22,
                    overflow: "hidden",
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                    marginRight: i === TEMPLATES.length - 1 ? 0 : PAGE_GAP,
                  }}
                >
                  {uri ? (
                    <Image
                      source={{ uri }}
                      style={{ width: PREVIEW_W, height: PREVIEW_H }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {previewLoading ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Icon
                          name="image-outline"
                          size={22}
                          color={colors.textMuted}
                        />
                      )}

                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: 12,
                          fontFamily: typography.fontFamily.medium,
                        }}
                      >
                        {previewLoading
                          ? "Building preview…"
                          : "Preview unavailable"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginTop: 12,
            }}
          >
            {TEMPLATES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === pageIndex ? 18 : 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor:
                    i === pageIndex ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
        </View>

        <Button title="Share" onPress={onShareMore} />

        <View style={{ position: "absolute", left: -9999, top: -9999 }}>
          <ViewShot
            ref={shotRef}
            options={{ format: "png", quality: 1 }}
            style={{ width: CAPTURE_W, height: CAPTURE_H }}
          >
            <WorkoutShareCard
              template={template}
              data={data}
              width={CAPTURE_W}
              height={CAPTURE_H}
            />
          </ViewShot>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </ModalSheet>
  );
}