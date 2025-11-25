// lib/useAppTheme.ts
import { useTheme } from "@react-navigation/native";

type AppThemeColors = {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
  muted: string;
  subtle: string;
  primaryBg: string;
  primaryText: string;
  successBg: string;
  successText: string;
  warnBg: string;
  warnText: string;
  danger: string;
  surface: string;
};
type AppTheme = { colors: AppThemeColors; dark: boolean };

export const useAppTheme = () => useTheme() as unknown as AppTheme;
