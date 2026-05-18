import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PurchasesOffering } from "react-native-purchases";
import { log } from "@/lib/logger";
import { useAuth } from "@/lib/authContext";
import { getRevenueCatOfferings } from "./revenuecat";

type BillingContextValue = {
  offering: PurchasesOffering | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { billingReady, userId } = useAuth();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!billingReady || !userId) {
      setOffering(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const nextOffering = await getRevenueCatOfferings();
      setOffering(nextOffering);
    } catch (err: any) {
      setOffering(null);
      setError(err?.message ?? "Failed to load purchase options.");
    } finally {
      setLoading(false);
    }
  }, [billingReady, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    log("RevenueCat billingReady:", billingReady);
    log("RevenueCat offering:", offering);
    log("Available packages:", offering?.availablePackages);
  }, [billingReady, offering]);

  const value = useMemo<BillingContextValue>(
    () => ({
      offering,
      loading,
      error,
      refresh,
    }),
    [offering, loading, error, refresh],
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling() {
  const ctx = useContext(BillingContext);

  if (!ctx) {
    throw new Error("useBilling must be used within BillingProvider");
  }

  return ctx;
}