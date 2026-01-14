// ui/index.ts

// tokens
export { getTheme, colors, palette, typography, layout } from "./tokens/theme";
export type { AppTheme, ThemeColors } from "./tokens/theme";

// icons
export { Icon } from "./icons/Icon";
export type { IconName } from "./icons/Icon";

// buttons
export { Button } from "./buttons/Button";
export type { ButtonProps, ButtonVariant } from "./buttons/Button";
export * from "./buttons/IconButton";
export * from "./buttons/SegmentedControl";

// cards
export { Card } from "./cards/Card";
export type { CardProps, CardVariant } from "./cards/Card";
export * from "./cards/MetricChip";
export * from "./cards/StatPillRow";
export * from "./cards/ExerciseRow";

export { ListRow } from "./cards/ListRow";
export type { ListRowProps } from "./cards/ListRow";

// navigation
export { BackButton } from "./navigation/BackButton";
export type { BackButtonProps } from "./navigation/BackButton";
export { ScreenHeader } from "./navigation/ScreenHeader";
export type { ScreenHeaderProps } from "./navigation/ScreenHeader";
export * from "./navigation/HeaderAction";
export * from "./navigation/TabBarSpacer";

// feedback
export { Loading } from "./feedback/Loading";
export { EmptyState } from "./feedback/EmptyState";
export { ErrorState } from "./feedback/ErrorState";
export { AuthRequiredState } from "./feedback/AuthRequiredState";
export { LoadingScreen } from "./feedback/LoadingScreen";
export { Pill } from "./feedback/Pill";
export type { PillTone } from "./feedback/Pill";
export { ProgressBar } from "./feedback/ProgressBar";
export { MiniRing } from "./feedback/MiniRing";

// layout
export { Screen } from "./layout/Screen";
export type { ScreenProps } from "./layout/Screen";
export * from "./layout/Section";
export * from "./layout/Divider";
export * from "./layout/StickyFooter";
export * from "./layout/SafeScroll";

// media
export * from "./media/WorkoutCover";

// modals
export { ModalSheet } from "./modals/ModalSheet";
export * from "./modals/ActionSheet";
export * from "./modals/SheetHandle";

// forms
export * from "./forms/StepperField";
export * from "./forms/ToggleRow";
export * from "./forms/NotesField";
export * from "./forms/SmallNumberInput";

// badges
export * from "./badges/Badge";
export * from "./badges/PRBadge";
