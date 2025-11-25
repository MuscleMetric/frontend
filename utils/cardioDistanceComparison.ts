// utils/cardioDistanceComparisons.ts

export type DistanceComparison = {
  threshold: number;  // in meters
  label: string;
};

/**
 * Distance comparisons (races + landmarks).
 * Sorted from largest → smallest.
 *
 * We walk this top-down and return the first
 * threshold the user's distance exceeds.
 */
export const CARDIO_DISTANCE_COMPARISONS: DistanceComparison[] = [
  // Long race distances
  { threshold: 50000, label: "a 50 km ultra (50,000m)" },
  { threshold: 42195, label: "a marathon (42,195m)" },
  { threshold: 30000, label: "a long 30 km run (30,000m)" },
  { threshold: 21097, label: "a half marathon (21,097m)" },
  { threshold: 15000, label: "a 15 km run (15,000m)" },
  { threshold: 10000, label: "a 10k race (10,000m)" },

  // Big mountains
  { threshold: 8848, label: "Mount Everest (8,848m)" },
  { threshold: 5000, label: "a 5 km climb (5,000m)" },
  { threshold: 4808, label: "Mont Blanc (4,808m)" },
  { threshold: 3776, label: "Mount Fuji (3,776m)" },
  { threshold: 1345, label: "Ben Nevis (1,345m)" },
  { threshold: 1085, label: "Snowdon (1,085m)" },

  // Iconic buildings
  { threshold: 828, label: "the Burj Khalifa (828m)" },
  { threshold: 381, label: "the Empire State Building (381m)" },
  { threshold: 330, label: "the Eiffel Tower (330m)" },
  { threshold: 135, label: "the London Eye (135m)" },
  { threshold: 96, label: "Big Ben (Elizabeth Tower, 96m)" },
  { threshold: 50, label: "the Arc de Triomphe (50m)" },
];

/**
 * Returns the largest comparison the user's distance exceeds.
 */
export function getDistanceComparison(
  distMeters: number
): DistanceComparison | null {
  for (const cmp of CARDIO_DISTANCE_COMPARISONS) {
    if (distMeters >= cmp.threshold) return cmp;
  }
  return null;
}
