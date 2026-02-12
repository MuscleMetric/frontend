import React, { useEffect, useMemo, useState } from "react";
import { AppState, View, Text, Alert } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { ModalSheet, Button, Card } from "@/ui";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";

import {
  loadLiveDraftForUser,
  clearLiveDraftForUser,
} from "@/app/features/workouts/live/persist/local";

import { clearServerDraft } from "@/app/features/workouts/live/persist/server";
import { clearAllMmLiveDraftKeysForUser } from "../live/persist/mmLocal";

type Draft = {
  draftId: string;
  userId: string;
  workoutId?: string | null;
  planWorkoutId?: string | null;
  title?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
};

function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;

  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function durationSince(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;

  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  const mm = Math.floor(diffSec / 60);
  const hh = Math.floor(mm / 60);

  if (hh > 0) return `${hh}h ${mm % 60}m`;
  return `${mm}m`;
}

export function ResumeWorkoutGate() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const router = useRouter();
  const pathname = usePathname();
  const { colors, typography, layout } = useAppTheme();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, userId]);

  // ✅ don’t show if already in live flow
  const shouldSuppress = useMemo(() => {
    return pathname?.startsWith("/features/workouts/live");
  }, [pathname]);

  useEffect(() => {
    if (shouldSuppress && open) setOpen(false);
  }, [shouldSuppress, open]);

  async function loadDraft() {
    if (!userId) return;

    const d = await loadLiveDraftForUser(userId);
    if (!d) {
      setDraft(null);
      setOpen(false);
      return;
    }

    setDraft(d as any);

    if (!shouldSuppress) setOpen(true);
  }

async function discardEverywhere() {
  if (!userId) return;

  setBusy(true);
  try {
    await clearLiveDraftForUser(userId);
    await clearAllMmLiveDraftKeysForUser(userId);
    await clearServerDraft(userId);

    setDraft(null);
    setOpen(false);
  } finally {
    setBusy(false);
  }
}


  function confirmDiscard() {
    Alert.alert(
      "Delete this session?",
      "This will permanently remove your in-progress workout from this device and the server.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: discardEverywhere },
      ]
    );
  }

  useEffect(() => {
    if (!userId) return;

    loadDraft();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") loadDraft();
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, shouldSuppress]);

  if (!userId) return null;
  if (!draft) return null;

  const title = draft.title?.trim() || "In-progress workout";
  const lastSaved = timeAgo(draft.updatedAt);
  const startedFor = durationSince(draft.startedAt);

  return (
    <ModalSheet
      visible={open}
      onClose={() => setOpen(false)}
      title="Continue workout?"
      subtitle={title}
      heightVariant="short"
    >
      {/* Summary card */}
      <Card>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: typography.fontFamily.bold,
                  fontSize: 18,
                  color: colors.text,
                  letterSpacing: -0.2,
                }}
              >
                Session recovered
              </Text>

              <Text
                style={{
                  marginTop: 4,
                  fontFamily: typography.fontFamily.medium,
                  fontSize: typography.size.sub,
                  color: colors.textMuted,
                }}
              >
                {startedFor ? `Started ${startedFor} ago` : "Started earlier"}
                {lastSaved ? ` • Last saved ${lastSaved}` : ""}
              </Text>
            </View>

            {/* little status dot */}
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: colors.primary,
                opacity: 0.9,
              }}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              opacity: 0.8,
            }}
          />

          <Text
            style={{
              fontFamily: typography.fontFamily.regular,
              fontSize: typography.size.sub,
              color: colors.textMuted,
              lineHeight: 18,
            }}
          >
            We found an autosaved workout draft. Continue to pick up where you
            left off, or delete it to start fresh.
          </Text>
        </View>
      </Card>

      {/* Primary CTA */}
      <Button
        title={busy ? "Please wait…" : "Continue"}
        disabled={busy}
        onPress={() => {
          setOpen(false);

          router.push({
            pathname: "/features/workouts/live",
            params: {
              workoutId: draft.workoutId ?? "",
              planWorkoutId: draft.planWorkoutId ?? "",
            },
          } as any);
        }}
      />

      {/* Secondary actions */}
      <View style={{ height: layout.space.sm }} />

      <Button
        title="Delete session"
        variant="ghost"
        disabled={busy}
        onPress={confirmDiscard}
      />

      {/* Optional: tiny debug line (remove if you want) */}
      <Text
        style={{
          marginTop: 8,
          textAlign: "center",
          fontFamily: typography.fontFamily.medium,
          fontSize: 11,
          color: colors.textMuted,
          opacity: 0.6,
        }}
      >
        Autosave is enabled
      </Text>
    </ModalSheet>
  );
}
