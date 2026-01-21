// ui/modals/ExercisePickerSheet.tsx
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, FlatList, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";

export type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
  muscleIds?: string[]; // string ids
};

type Chip = { id: string; label: string };

function capFirst(v: string) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}
function includesQ(s: string | null | undefined, q: string) {
  return (s ?? "").toLowerCase().includes(q);
}

function Pill(props: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  rightIcon?: string;
  leftIcon?: string;
}) {
  const { colors, typography } = useAppTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: props.active ? colors.primary : colors.border,
        backgroundColor: props.active ? colors.primary : colors.surface ?? colors.bg,
      }}
    >
      {props.leftIcon ? (
        <Text style={{ color: props.active ? "#fff" : colors.textMuted, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
          {props.leftIcon}
        </Text>
      ) : null}
      <Text style={{ color: props.active ? "#fff" : colors.text, fontFamily: typography.fontFamily.semibold, fontSize: 13 }}>
        {props.label}
      </Text>
      {props.rightIcon ? (
        <Text style={{ color: props.active ? "#fff" : colors.textMuted, fontFamily: typography.fontFamily.bold, fontSize: 13 }}>
          {props.rightIcon}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Badge(props: { label: string }) {
  const { colors, typography } = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: 12 }}>
        {props.label}
      </Text>
    </View>
  );
}

function CardRow(props: {
  item: ExerciseOption;
  disabled: boolean;
  selected: boolean;
  usedCount: number;
  fav: boolean;
  onToggle: () => void;
  onToggleFav?: () => void;
  badgeMuscle?: string | null;
}) {
  const { colors, typography } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        if (props.disabled) return;
        Keyboard.dismiss();
        props.onToggle();
      }}
      disabled={props.disabled}
      style={{
        borderWidth: 1,
        borderColor: props.selected ? colors.primary : colors.border,
        backgroundColor: colors.surface ?? colors.bg,
        borderRadius: 18,
        padding: 14,
        opacity: props.disabled ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 15 }}>
            {props.item.name ?? "Exercise"}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {props.badgeMuscle ? <Badge label={props.badgeMuscle} /> : null}
            {props.item.equipment ? <Badge label={capFirst(props.item.equipment)} /> : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
            <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: 12 }}>
              {props.usedCount > 0 ? `Used: ${props.usedCount} times` : "Never used"}
            </Text>
            {props.disabled ? (
              <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: 12 }}>
                • In workout
              </Text>
            ) : null}
          </View>
        </View>

        {/* star */}
        {props.onToggleFav ? (
          <Pressable
            onPress={(e: any) => {
              e?.stopPropagation?.();
              props.onToggleFav?.();
            }}
            hitSlop={10}
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 18, fontFamily: typography.fontFamily.bold, color: props.fav ? colors.primary : colors.textMuted }}>
              {props.fav ? "★" : "☆"}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}

        {/* checkbox */}
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: props.selected ? colors.primary : colors.border,
            backgroundColor: props.selected ? colors.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          {props.selected ? (
            <Text style={{ color: "#fff", fontFamily: typography.fontFamily.bold, fontSize: 12 }}>✓</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ExercisePickerSheet(props: {
  // header
  title?: string;

  // data
  options: ExerciseOption[];
  alreadyInIds?: string[];
  isReplaceMode?: boolean;
  replacingExerciseId?: string | null;

  // meta ordering
  usageByExerciseId?: Record<string, number>;

  // favourites
  favoriteIds?: Set<string>;
  favoritesOnly?: boolean;
  onToggleFavoritesOnly?: () => void;
  onToggleFavorite?: (exerciseId: string) => void;

  // filters
  muscleGroups?: Chip[];
  selectedMuscleId?: string | null;
  onChangeSelectedMuscleId?: (id: string | null) => void;

  equipmentOptions?: string[];
  selectedEquipment?: string | null;
  onChangeSelectedEquipment?: (eq: string | null) => void;

  // search
  search: string;
  onChangeSearch: (v: string) => void;

  // selection
  selectedIds: string[];
  onChangeSelectedIds: (ids: string[]) => void;
  multiSelect?: boolean;

  // actions
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [muscleMenuOpen, setMuscleMenuOpen] = useState(false);
  const [equipmentMenuOpen, setEquipmentMenuOpen] = useState(false);

  const alreadyIn = useMemo(() => new Set(props.alreadyInIds ?? []), [props.alreadyInIds]);
  const favIds = props.favoriteIds ?? new Set<string>();
  const usage = props.usageByExerciseId ?? {};

  function toggleId(id: string) {
    const exists = props.selectedIds.includes(id);
    if (!props.multiSelect) {
      props.onChangeSelectedIds(exists ? [] : [id]);
      return;
    }
    props.onChangeSelectedIds(exists ? props.selectedIds.filter((x) => x !== id) : [...props.selectedIds, id]);
  }

  const selectedMuscleLabel = useMemo(() => {
    if (!props.selectedMuscleId) return null;
    return props.muscleGroups?.find((m) => m.id === props.selectedMuscleId)?.label ?? null;
  }, [props.selectedMuscleId, props.muscleGroups]);

  const filtered = useMemo(() => {
    const q = props.search.trim().toLowerCase();
    const favoritesOnly = Boolean(props.favoritesOnly);

    const out = (props.options ?? []).filter((ex) => {
      if (favoritesOnly && !favIds.has(ex.id)) return false;

      if (props.selectedEquipment) {
        const eq = (ex.equipment ?? "").toLowerCase();
        if (eq !== props.selectedEquipment.toLowerCase()) return false;
      }

      if (props.selectedMuscleId) {
        const m = ex.muscleIds ?? [];
        if (!m.includes(props.selectedMuscleId)) return false;
      }

      if (!q) return true;
      return includesQ(ex.name, q) || includesQ(ex.type, q) || includesQ(ex.equipment, q);
    });

    // REQUIRED ordering:
    // 1) disabled (already in workout, except replacing)
    // 2) favourites
    // 3) used before (desc)
    // 4) alpha
    out.sort((a, b) => {
      const aIsReplacing = Boolean(props.isReplaceMode) && props.replacingExerciseId === a.id;
      const bIsReplacing = Boolean(props.isReplaceMode) && props.replacingExerciseId === b.id;

      const aDisabled = alreadyIn.has(a.id) && !aIsReplacing;
      const bDisabled = alreadyIn.has(b.id) && !bIsReplacing;
      if (aDisabled !== bDisabled) return aDisabled ? -1 : 1;

      const aFav = favIds.has(a.id);
      const bFav = favIds.has(b.id);
      if (aFav !== bFav) return aFav ? -1 : 1;

      const aUse = usage[a.id] ?? 0;
      const bUse = usage[b.id] ?? 0;
      const aUsed = aUse > 0;
      const bUsed = bUse > 0;
      if (aUsed !== bUsed) return aUsed ? -1 : 1;
      if (aUse !== bUse) return bUse - aUse;

      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    return out;
  }, [
    props.options,
    props.search,
    props.favoritesOnly,
    favIds,
    usage,
    alreadyIn,
    props.isReplaceMode,
    props.replacingExerciseId,
    props.selectedMuscleId,
    props.selectedEquipment,
  ]);

  const selectedCount = props.selectedIds.length;
  const canConfirm = selectedCount > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              props.onClose();
            }}
            hitSlop={12}
            style={{ width: 70 }}
          >
            <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold }}>
              Back
            </Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 26, letterSpacing: -0.6 }}>
              {props.title ?? "Select Exercises"}
            </Text>
          </View>

          <View style={{ width: 70 }} />
        </View>

        {/* Search */}
        <View style={{ marginTop: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 999,
              backgroundColor: colors.surface ?? colors.bg,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <TextInput
              value={props.search}
              onChangeText={props.onChangeSearch}
              placeholder="Search exercises…"
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                color: colors.text,
                fontFamily: typography.fontFamily.medium,
                fontSize: 15,
              }}
              returnKeyType="search"
              blurOnSubmit
            />
          </View>
        </View>

        {/* Filters */}
        <View style={{ marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Pill
            label=""
            leftIcon={props.favoritesOnly ? "★" : "☆"}
            active={Boolean(props.favoritesOnly)}
            onPress={() => {
              Keyboard.dismiss();
              props.onToggleFavoritesOnly?.();
            }}
          />

          <Pill
            label={selectedMuscleLabel ?? "Muscle"}
            active={Boolean(props.selectedMuscleId)}
            rightIcon={selectedMuscleLabel ? "×" : "⌄"}
            onPress={() => {
              Keyboard.dismiss();
              if (props.selectedMuscleId) props.onChangeSelectedMuscleId?.(null);
              else setMuscleMenuOpen((v) => !v);
              setEquipmentMenuOpen(false);
            }}
          />

          <Pill
            label={props.selectedEquipment ? capFirst(props.selectedEquipment) : "All Equipment"}
            active={Boolean(props.selectedEquipment)}
            rightIcon={props.selectedEquipment ? "×" : "⌄"}
            onPress={() => {
              Keyboard.dismiss();
              if (props.selectedEquipment) props.onChangeSelectedEquipment?.(null);
              else setEquipmentMenuOpen((v) => !v);
              setMuscleMenuOpen(false);
            }}
          />
        </View>

        {/* Dropdowns */}
        {muscleMenuOpen && (props.muscleGroups?.length ?? 0) > 0 ? (
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {props.muscleGroups!.map((m) => (
              <Pill
                key={m.id}
                label={m.label}
                active={props.selectedMuscleId === m.id}
                onPress={() => {
                  Keyboard.dismiss();
                  props.onChangeSelectedMuscleId?.(m.id);
                  setMuscleMenuOpen(false);
                }}
              />
            ))}
          </View>
        ) : null}

        {equipmentMenuOpen && (props.equipmentOptions?.length ?? 0) > 0 ? (
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {props.equipmentOptions!.map((eq) => (
              <Pill
                key={eq}
                label={capFirst(eq)}
                active={props.selectedEquipment === eq}
                onPress={() => {
                  Keyboard.dismiss();
                  props.onChangeSelectedEquipment?.(eq);
                  setEquipmentMenuOpen(false);
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(x) => x.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 120,
          gap: 10,
        }}
        renderItem={({ item }) => {
          const isReplacing = Boolean(props.isReplaceMode) && props.replacingExerciseId === item.id;
          const disabled = alreadyIn.has(item.id) && !isReplacing;

          const selected = props.selectedIds.includes(item.id);
          const usedCount = usage[item.id] ?? 0;
          const fav = favIds.has(item.id);

          return (
            <CardRow
              item={item}
              disabled={disabled}
              selected={selected}
              usedCount={usedCount}
              fav={fav}
              badgeMuscle={selectedMuscleLabel}
              onToggle={() => toggleId(item.id)}
              onToggleFav={props.onToggleFavorite ? () => props.onToggleFavorite?.(item.id) : undefined}
            />
          );
        }}
      />

      {/* Bottom bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 14,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: 12 }}>
            {selectedCount} exercise{selectedCount === 1 ? "" : "s"} selected
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => props.onChangeSelectedIds([])} hitSlop={10}>
            <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.bold, fontSize: 12 }}>
              Clear all
            </Text>
          </Pressable>
        </View>

        <Pressable
          disabled={!canConfirm}
          onPress={() => {
            Keyboard.dismiss();
            props.onConfirm(props.selectedIds);
          }}
          style={{
            height: 56,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canConfirm ? colors.primary : colors.border,
            opacity: canConfirm ? 1 : 0.65,
          }}
        >
          <Text style={{ color: "#fff", fontFamily: typography.fontFamily.bold, fontSize: 16 }}>
            Confirm selection{selectedCount > 0 ? `  (${selectedCount})` : ""}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
