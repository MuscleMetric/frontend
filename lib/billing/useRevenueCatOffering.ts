import { useCallback, useEffect, useState } from "react";
import type { PurchasesOffering } from "react-native-purchases";
import { getCurrentOffering } from "./revenuecat";

export function useRevenueCatOffering() {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await getCurrentOffering();
      setOffering(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offering");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    offering,
    loading,
    error,
    refresh,
  };
}