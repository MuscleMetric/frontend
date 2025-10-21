// app/theme.ts
import { DarkTheme as NavDark, DefaultTheme as NavLight } from '@react-navigation/native';

export const LightTheme = {
  ...NavLight,
  colors: {
    ...NavLight.colors,
    primary: '#0b6aa9',
    background: '#F7F8FA',
    card: '#FFFFFF',
    text: '#111827',
    border: '#E5E7EB',
    notification: '#0b6aa9',
    muted: '#6b7280',
    subtle: '#9ca3af',
    primaryBg: '#e6f0ff',
    primaryText: '#0b6aa9',
    successBg: '#e6f6ea',
    successText: '#16a34a',
    warnBg: '#fff3e0',
    warnText: '#b45309',
    danger: '#ef4444',
    surface: '#FDFEFE',
  },
};

export const DarkTheme = {
  ...NavDark,
  colors: {
    ...NavDark.colors,
    primary: '#93c5fd',
    background: '#0B1220',
    card: '#111827',
    text: '#F9FAFB',
    border: '#1F2937',
    notification: '#60a5fa',
    muted: '#9CA3AF',
    subtle: '#6B7280',
    primaryBg: '#0f172a',
    primaryText: '#93c5fd',
    successBg: '#052e1a',
    successText: '#86efac',
    warnBg: '#3b2a07',
    warnText: '#fcd34d',
    danger: '#f87171',
    surface: '#0f1628',
  },
};
