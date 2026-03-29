import React from "react";
import { View, Text, Alert } from "react-native";
import { ModalSheet, Button, Card } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { useActiveWorkoutSession } from "@/app/features/workouts/live/session/useActiveWorkoutSession";
import { useAuth } from "@/lib/authContext";
import { clearLiveDraftForUser } from "@/app/features/workouts/live/persist/local";
import { clearServerDraft } from "@/app/features/workouts/live/persist/server";
import { clearAllMmLiveDraftKeysForUser } from "../live/persist/mmLocal";

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
  const { colors, typography, layout } = useAppTheme();

  const {
    activeDraft,
    shouldShowResumeGate,
    resumeWorkout,
    clearSnapshot,
    refresh,
    dismissResumeGate,
  } = useActiveWorkoutSession();

  const [busy, setBusy] = React.useState(false);

  if (!userId || !activeDraft) return null;

  const safeUserId = userId;

  async function discardEverywhere() {
    setBusy(true);
    try {
      await clearLiveDraftForUser(safeUserId);
      await clearAllMmLiveDraftKeysForUser(safeUserId);
      await clearServerDraft(safeUserId);
      clearSnapshot();
      await refresh();
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
      ],
    );
  }

  const title = activeDraft.title?.trim() || "In-progress workout";
  const lastSaved = timeAgo(activeDraft.updatedAt);
  const startedFor = durationSince(activeDraft.startedAt);

  return (
    <ModalSheet
      visible={shouldShowResumeGate}
      onClose={dismissResumeGate}
      title="Continue workout?"
      subtitle={title}
      heightVariant="short"
    >
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

      <Button
        title={busy ? "Please wait…" : "Continue"}
        disabled={busy}
        onPress={resumeWorkout}
      />

      <View style={{ height: layout.space.sm }} />

      <Button
        title="Delete session"
        variant="ghost"
        disabled={busy}
        onPress={confirmDiscard}
      />
    </ModalSheet>
  );
}
