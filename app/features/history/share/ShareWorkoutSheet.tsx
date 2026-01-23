import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  Image,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import ViewShot from "react-native-view-shot";
import { useAppTheme } from "@/lib/useAppTheme";
import { ModalSheet, Button, Icon } from "@/ui";

import type { ShareTemplateId, ShareWorkoutData } from "./workoutShare";
import { buildShareText, copyText, savePngToPhotos, sharePng } from "./workoutShare";
import { WorkoutShareCard } from "./WorkoutShareCard";

const TEMPLATES: { id: ShareTemplateId; label: string }[] = [
  { id: "brand", label: "MuscleMetric" },
  { id: "transparent", label: "Transparent" },
  { id: "black", label: "Black" },
];

// tiny util
function clamp(n: number, min: number, max: number) {
  "worklet";
  return Math.max(min, Math.min(max, n));
}

export function ShareWorkoutSheet({
  visible,
  onClose,
  data,
  shareUrl,
}: {
  visible: boolean;
  onClose: () => void;
  data: ShareWorkoutData;
  shareUrl?: string | null;
}) {
  const { colors, typography } = useAppTheme();

  // sizes
  const CAPTURE_W = 1080;
  const CAPTURE_H = 1920;

  const PREVIEW_W = 270;
  const PREVIEW_H = 480;

  // carousel state
  const pagerRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // template state still exists as the “current” capture/share template
  const [template, setTemplate] = useState<ShareTemplateId>("brand");

  // store per-template preview so pages are truly different
  const [previewUris, setPreviewUris] = useState<Record<ShareTemplateId, string | null>>({
    brand: null,
    transparent: null,
    black: null,
  });
  const [previewLoading, setPreviewLoading] = useState(false);

  const shotRef = useRef<ViewShot>(null);

  const shareText = useMemo(() => buildShareText(data), [data]);

  // ensure template follows current page
  useEffect(() => {
    setTemplate(TEMPLATES[pageIndex]?.id ?? "brand");
  }, [pageIndex]);

  async function capturePng() {
    const uri = await shotRef.current?.capture?.();
    if (!uri) throw new Error("Failed to capture share image");
    return uri;
  }

  // build ALL previews when sheet becomes visible or data changes
  // (so carousel pages show correct image)
  useEffect(() => {
    let alive = true;

    async function buildAllPreviews() {
      if (!visible) return;

      setPreviewLoading(true);
      try {
        // reset preview uris so loading state is obvious
        if (alive) {
          setPreviewUris({ brand: null, transparent: null, black: null });
        }

        // one-by-one capture for each template
        for (const t of TEMPLATES) {
          if (!alive) return;

          // switch the offscreen renderer template
          setTemplate(t.id);

          // wait a tick for state/layout to settle (important)
          await new Promise((r) => setTimeout(r, 60));

          const uri = await capturePng();

          if (alive) {
            setPreviewUris((prev) => ({ ...prev, [t.id]: uri }));
          }
        }

        // restore template to current page at end
        if (alive) setTemplate(TEMPLATES[pageIndex]?.id ?? "brand");
      } catch {
        // leave as nulls
      } finally {
        if (alive) setPreviewLoading(false);
      }
    }

    buildAllPreviews();
    return () => {
      alive = false;
    };
    // important: don’t include `template` here, or you’ll loop
  }, [visible, data]);

  function onPagerEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const next = clamp(Math.round(x / (PREVIEW_W + 12)), 0, TEMPLATES.length - 1);
    setPageIndex(next);
  }

  async function onShareMore() {
    try {
      // make sure offscreen renderer is set to the currently selected template
      const current = TEMPLATES[pageIndex]?.id ?? "brand";
      if (template !== current) setTemplate(current);

      await new Promise((r) => setTimeout(r, 40));
      const uri = await capturePng();
      await sharePng(uri);
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Unknown error");
    }
  }

  async function onSave() {
    try {
      const current = TEMPLATES[pageIndex]?.id ?? "brand";
      if (template !== current) setTemplate(current);

      await new Promise((r) => setTimeout(r, 40));
      const uri = await capturePng();
      await savePngToPhotos(uri);
      Alert.alert("Saved", "Saved to Photos.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Unknown error");
    }
  }

  async function onCopy() {
    try {
      await copyText(shareText);
      Alert.alert("Copied", "Workout text copied.");
    } catch (e: any) {
      Alert.alert("Copy failed", e?.message ?? "Unknown error");
    }
  }

  async function onCopyLink() {
    if (!shareUrl) {
      Alert.alert("No link", "No share link is available yet.");
      return;
    }
    await copyText(shareUrl);
    Alert.alert("Copied", "Link copied.");
  }

  const currentTemplateLabel = TEMPLATES[pageIndex]?.label ?? "Template";

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Share Activity">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* ✅ Title above carousel */}
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.semibold,
              fontSize: 14,
              color: colors.text,
            }}
          >
            {currentTemplateLabel}
          </Text>
          {previewLoading ? (
            <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 12 }}>
              Building previews…
            </Text>
          ) : null}
        </View>

        {/* ✅ Swipe carousel */}
        <View style={{ alignItems: "center" }}>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPagerEnd}
            // make paging feel nicer across platforms
            decelerationRate="fast"
            snapToInterval={PREVIEW_W + 12}
            snapToAlignment="center"
            contentContainerStyle={{ paddingHorizontal: 2 }}
          >
            {TEMPLATES.map((t, i) => {
              const uri = previewUris[t.id];

              return (
                <View
                  key={t.id}
                  style={{
                    width: PREVIEW_W,
                    height: PREVIEW_H,
                    borderRadius: 18,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: i === pageIndex ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                    marginRight: i === TEMPLATES.length - 1 ? 0 : 12,
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
                        <ActivityIndicator />
                      ) : (
                        <Icon name="image-outline" size={22} color={colors.textMuted} />
                      )}
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {previewLoading ? "Building preview…" : "Preview unavailable"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* ✅ Dots */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginTop: 10,
            }}
          >
            {TEMPLATES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: i === pageIndex ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
        </View>

        {/* Actions (keep what you want) */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Button title="Share" onPress={onShareMore} />
          {/* Optional extras if you want them visible */}
          {/* <Button title="Save" onPress={onSave} /> */}
          {/* <Button title="Copy text" onPress={onCopy} /> */}
          {/* <Button title="Copy link" onPress={onCopyLink} /> */}
        </View>

        {/* ✅ Hidden capture renderer (offscreen) */}
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
