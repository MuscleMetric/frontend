// utils/animalVolumeComparisons.ts

export type VolumeComparison = {
  threshold: number; // kg
  label: string; // main label
  base?: string; // smaller object used for multiples
};

/**
 * A smooth progression of comparisons from 50kg → 50,000kg.
 * No big jumps, roughly 100–300 kg increments.
 *
 * Option D style:
 * - First comparison: closest equal-or-below real world object
 * - Secondary: multiple of a smaller object (computed in getVolumeComparison)
 */
export const ANIMAL_VOLUME_COMPARISONS: VolumeComparison[] = [
  { threshold: 50, label: "a large gym plate (50kg)", base: "50kg plate" },
  { threshold: 80, label: "a wild boar (80kg)", base: "wild boar (80kg)" },
  { threshold: 100, label: "a barbell loaded with 100kg", base: "100kg load" },
  { threshold: 120, label: "a giant panda (120kg)", base: "panda (120kg)" },
  { threshold: 150, label: "a motorcycle engine block (150kg)" },
  { threshold: 180, label: "a refrigerator (180kg)" },
  { threshold: 200, label: "a tiger (200kg)", base: "tiger (200kg)" },
  { threshold: 250, label: "a vending machine (250kg)" },
  { threshold: 300, label: "a brown bear (300kg)", base: "brown bear (300kg)" },
  { threshold: 350, label: "a commercial dryer (350kg)" },
  { threshold: 400, label: "a grand piano frame (400kg)" },
  { threshold: 450, label: "a polar bear (450kg)", base: "polar bear (450kg)" },
  { threshold: 500, label: "a compact car engine (500kg)" },
  { threshold: 600, label: "a horse (600kg)", base: "horse (600kg)" },
  { threshold: 700, label: "a small car chassis (700kg)" },
  { threshold: 800, label: "a side-by-side ATV (800kg)" },
  { threshold: 900, label: "a small car (900kg)" },
  { threshold: 1000, label: "a bison (1,000kg)", base: "bison (1,000kg)" },
  { threshold: 1200, label: "a giraffe (1,200kg)", base: "giraffe (1,200kg)" },
  { threshold: 1400, label: "a compact hatchback (1,400kg)" },
  { threshold: 1600, label: "a small family car (1,600kg)" },
  {
    threshold: 1800,
    label: "a hippopotamus (1,800kg)",
    base: "hippo (1,800kg)",
  },
  { threshold: 2000, label: "a medium car (2,000kg)" },
  {
    threshold: 2300,
    label: "a white rhinoceros (2,300kg)",
    base: "rhino (2,300kg)",
  },
  { threshold: 2600, label: "a pickup truck (2,600kg)" },
  { threshold: 3000, label: "a beefed-up SUV (3,000kg)" },
  { threshold: 3500, label: "a cargo van (3,500kg)" },
  { threshold: 4000, label: "a heavy-duty SUV (4,000kg)" },
  { threshold: 4500, label: "a large cargo van (4,500kg)" },
  { threshold: 5000, label: "a 20ft shipping container (5,000kg)" },
  {
    threshold: 6000,
    label: "an African elephant (6,000kg)",
    base: "elephant (6,000kg)",
  },
  { threshold: 7000, label: "a small bus (7,000kg)" },
  { threshold: 8000, label: "a motorhome (8,000kg)" },
  { threshold: 9000, label: "a forklift (9,000kg)" },
  { threshold: 10000, label: "a city bus front axle load (10,000kg)" },
  { threshold: 12000, label: "a loaded dump truck front section (12,000kg)" },
  { threshold: 15000, label: "a small fire engine (15,000kg)" },
  { threshold: 20000, label: "a full fire engine (20,000kg)" },
  { threshold: 25000, label: "a bulldozer (25,000kg)" },
  { threshold: 30000, label: "a railway locomotive bogie (30,000kg)" },
  { threshold: 35000, label: "a 40ft loaded shipping container (35,000kg)" },
  { threshold: 40000, label: "a diesel locomotive engine block (40,000kg)" },
  { threshold: 45000, label: "a full train carriage shell (45,000kg)" },
  { threshold: 50000, label: "a tank (50,000kg)", base: "tank (50,000kg)" },
];

/**
 * Finds the closest primary comparison AND a meaningful multiplicative comparison.
 */
export function getVolumeComparison(volumeKg: number): string {
  if (volumeKg <= 0) return "almost nothing";

  // 1. Find the largest threshold <= volume
  let primary = ANIMAL_VOLUME_COMPARISONS[0];
  for (const cmp of ANIMAL_VOLUME_COMPARISONS) {
    if (volumeKg >= cmp.threshold) primary = cmp;
  }

  // 2. Find a smaller "base" item for multiples
  //    Always choose the smallest base that makes sense (starts around 80–200kg)
  const baseItem =
    ANIMAL_VOLUME_COMPARISONS.find((c) => c.base) ||
    ANIMAL_VOLUME_COMPARISONS[0];

  const baseThreshold = baseItem.threshold;

  const multiple = volumeKg / baseThreshold;

  // 3. Build sentence
  const primaryLabel = primary.label;
  const baseLabel = baseItem.base ?? baseItem.label;

  const multipleStr =
    multiple >= 10
      ? `${multiple.toFixed(0)}×`
      : multiple >= 3
      ? `${multiple.toFixed(1)}×`
      : multiple.toFixed(2) + "×";

  return `${primaryLabel} (≈ ${multipleStr} ${baseLabel})`;
}
