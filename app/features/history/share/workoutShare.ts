import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as MediaLibrary from "expo-media-library";
import { Share, Platform } from "react-native";

export type ShareTemplateId = "transparent" | "black";

export type SharePR = {
  exerciseName: string;
  label: string;
  value: string;
  kind: "strength" | "cardio";
};

export type ShareWorkoutData = {
  title: string;
  dateLabel: string;
  durationLabel: string;

  totalSets: number | null;
  totalVolumeKg: number | null;
  totalDistanceKm: number | null;

  prs: SharePR[];

  exercises: Array<{
    name: string;
    sets: Array<{
      setNumber: number;
      weightKg?: number | null;
      reps?: number | null;
      timeSeconds?: number | null;
      distance?: number | null;
    }>;
  }>;
};

export async function sharePng(uri: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "Share workout",
      UTI: "public.png",
    });
    return;
  }

  await Share.share(
    Platform.select({
      ios: { url: uri },
      android: { url: uri, message: "Workout" },
      default: { url: uri },
    }) as any,
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

function fmtVolume(v?: number | null) {
  if (v == null || !Number.isFinite(v)) return null;
  return `${Math.round(v)} kg`;
}

function fmtDistance(v?: number | null) {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  const rounded = Math.round(v * 100) / 100;
  return `${rounded} km`;
}

export function buildShareText(d: ShareWorkoutData) {
  const lines: string[] = [];

  lines.push(`${d.title} — ${d.dateLabel}`);
  lines.push(`Duration: ${d.durationLabel}`);

  const volume = fmtVolume(d.totalVolumeKg);
  const distance = fmtDistance(d.totalDistanceKm);

  if (volume) lines.push(`Volume: ${volume}`);
  if (distance) lines.push(`Distance: ${distance}`);
  if (d.totalSets != null) lines.push(`Sets: ${d.totalSets}`);

  if (d.prs.length > 0) {
    lines.push("");
    lines.push("PRs:");
    for (const pr of d.prs.slice(0, 6)) {
      lines.push(`• ${pr.exerciseName}: ${pr.label} — ${pr.value}`);
    }
  }

  lines.push("");
  lines.push("Tracked with MuscleMetric");

  return lines.join("\n");
}