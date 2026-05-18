import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const REVENUECAT_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "";

let configuredUserId: string | null = null;
let configurePromise: Promise<void> | null = null;

export async function configureRevenueCat(appUserId?: string | null) {
  const userId = appUserId ?? null;

  if (!REVENUECAT_API_KEY) {
    throw new Error("Missing EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY");
  }

  if (configuredUserId === userId) {
    return;
  }

  if (configurePromise) {
    await configurePromise;
    if (configuredUserId === userId) return;
  }

  configurePromise = (async () => {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      ...(userId ? { appUserID: userId } : {}),
    });

    configuredUserId = userId;
  })();

  try {
    await configurePromise;
  } finally {
    configurePromise = null;
  }
}

export function isRevenueCatConfigured() {
  return configuredUserId !== null;
}

export async function logoutRevenueCat() {
  configuredUserId = null;
  configurePromise = null;
  await Purchases.logOut();
}

export async function getRevenueCatOfferings(): Promise<PurchasesOffering | null> {
  if (!isRevenueCatConfigured()) {
    throw new Error("RevenueCat is not configured yet.");
  }

  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchaseRevenueCatPackage(pkg: PurchasesPackage) {
  if (!isRevenueCatConfigured()) {
    throw new Error("RevenueCat is not configured yet.");
  }

  return Purchases.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases() {
  if (!isRevenueCatConfigured()) {
    throw new Error("RevenueCat is not configured yet.");
  }

  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  if (!isRevenueCatConfigured()) {
    throw new Error("RevenueCat is not configured yet.");
  }

  return Purchases.getCustomerInfo();
}