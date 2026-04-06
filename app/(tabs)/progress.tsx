import React, { useEffect } from "react";
import { ProgressScreen } from "@/app/features/progress";
import { useAuth } from "@/lib/authContext";

export default function ProgressRoute() {
  const auth = useAuth();

  useEffect(() => {
    const debugPayload = {
      loading: auth.loading,
      entitlementsLoading: auth.entitlementsLoading,
      userId: auth.userId,
      sessionUserId: auth.session?.user?.id ?? null,
      profile: auth.profile,
      entitlements: auth.entitlements,
      capabilities: auth.capabilities,
    };

    console.log("[Progress Debug]", JSON.stringify(debugPayload, null, 2));
  }, [
    auth.loading,
    auth.entitlementsLoading,
    auth.userId,
    auth.session?.user?.id,
    auth.profile,
    auth.entitlements,
    auth.capabilities,
  ]);

  return <ProgressScreen />;
}