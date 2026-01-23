import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as MediaLibrary from "expo-media-library";
import { Share, Platform } from "react-native";

export type ShareTemplateId = "transparent" | "black" | "brand";

export type ShareWorkoutData = {
  title: string;
  dateLabel: string; // e.g. "Thu 22 Jan"
  durationLabel: string; // e.g. "56m"
  totalSets: number | null;
  totalVolumeKg: number | null;

  exercises: Array<{
    name: string;
    sets: Array<{ setNumber: number; weightKg?: number | null; reps?: number | null }>;
  }>;

  prs: Array<{
    exerciseName: string;
    weightKg?: number | null;
    reps?: number | null;
    e1rm?: number | null;
  }>;
};

export async function sharePng(uri: string) {
  // Prefer expo-sharing if available (best for images)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "Share workout",
      UTI: "public.png",
    });
    return;
  }

  // Fallback: RN Share
  await Share.share(
    Platform.select({
      ios: { url: uri },
      android: { url: uri, message: "Workout" },
      default: { url: uri },
    }) as any
  );
}

export async function savePngToPhotos(uri: string) {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") throw new Error("Photos permission not granted");

  const asset = await MediaLibrary.createAssetAsync(uri);

  try {
    await MediaLibrary.createAlbumAsync("MuscleMetric", asset, false);
  } catch {
    // album may already exist
  }
}

export async function copyText(text: string) {
  await Clipboard.setStringAsync(text);
}

export function buildShareText(d: ShareWorkoutData) {
  const lines: string[] = [];
  lines.push(`${d.title} — ${d.dateLabel}`);
  lines.push(`Duration: ${d.durationLabel}`);
  if (d.totalSets != null) lines.push(`Total sets: ${d.totalSets}`);
  if (d.totalVolumeKg != null)
    lines.push(`Total volume: ${Math.round(d.totalVolumeKg)} kg`);

  if (d.prs.length) {
    lines.push("");
    lines.push("PRs:");
    for (const p of d.prs.slice(0, 6)) {
      const set =
        p.weightKg != null && p.reps != null ? `${p.weightKg} × ${p.reps}` : "—";
      lines.push(`• ${p.exerciseName}: ${set}`);
    }
  }

  return lines.join("\n");
}
