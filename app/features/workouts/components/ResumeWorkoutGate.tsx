import React, { useEffect, useMemo, useState } from "react";
import { AppState, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, usePathname } from "expo-router";
import { ModalSheet, Button, Card } from "@/ui";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";


type Draft = {
  clientSaveId: string;
  workoutId: string;
  planWorkoutId?: string | null;
  title?: string | null;
  startedAt?: string | null;
  lastTouchedAt?: string | null;
};

function keyFor(userId: string) {
  return `mm_live_session_draft:${userId}`;
}

export function ResumeWorkoutGate() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const { typography, colors, layout } = useAppTheme();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);

  const shouldSuppress = useMemo(() => {
    // don't prompt if already in the live flow
    return pathname?.startsWith("/workouts/live");
  }, [pathname]);

  async function loadDraft() {
    if (!userId) return;
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) {
      setDraft(null);
      setOpen(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Draft;
      // very light validation
      if (!parsed?.clientSaveId || !parsed?.workoutId) {
        setDraft(null);
        setOpen(false);
        return;
      }
      setDraft(parsed);
      if (!shouldSuppress) setOpen(true);
    } catch {
      setDraft(null);
      setOpen(false);
    }
  }

  async function discardDraft() {
    if (!userId) return;
    await AsyncStorage.removeItem(keyFor(userId));
    setDraft(null);
    setOpen(false);
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

  return (
    <ModalSheet
      visible={open}
      onClose={() => setOpen(false)}
      title="Continue workout?"
      subtitle={draft?.title ? draft.title : "You have an in-progress session"}
      heightVariant="default"
    >
      <Card>
        <CardContent
          title="Session found"
          body={`Workout ID: ${draft?.workoutId}\nSave ID: ${draft?.clientSaveId}`}
        />
      </Card>

      <Button
        title="Continue"
        onPress={() => {
          setOpen(false);
          router.push("/workouts/live");
        }}
      />

      <Button title="Discard" variant="ghost" onPress={discardDraft} />

      <Button title="Not now" variant="text" onPress={() => setOpen(false)} />
    </ModalSheet>
  );
}

// tiny helper so we don’t assume you have a CardContent component
function CardContent({ title, body }: { title: string; body: string }) {
  const { typography, colors, layout } = useAppTheme();
  return (
    <>
      <Text
        style={{
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          color: colors.text,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: layout.space.xs,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          color: colors.textMuted,
        }}
      >
        {body}
      </Text>
    </>
  );
}
