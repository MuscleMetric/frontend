// lib/useAppTheme.ts
import { useColorScheme } from "react-native";
import { getTheme, type AppTheme, type ColorScheme } from "@/ui/tokens/theme";

export function useAppTheme(): AppTheme {
  const scheme = (useColorScheme() ?? "dark") as ColorScheme;
  return getTheme(scheme);
}
