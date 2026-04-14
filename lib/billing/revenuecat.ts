import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

let configuredUserId: string | null = null;

function getRevenueCatApiKey(): string {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
  if (!key) {
    throw new Error("Missing EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY");
  }
  return key;
}

export async function configureRevenueCat(userId: string): Promise<void> {
  if (Platform.OS !== "ios") return;
  if (!userId) throw new Error("configureRevenueCat requires a user id");
  if (configuredUserId === userId) return;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

  await Purchases.configure({
    apiKey: getRevenueCatApiKey(),
    appUserID: userId,
  });

  configuredUserId = userId;
}

export async function logoutRevenueCat(): Promise<void> {
  if (Platform.OS !== "ios") return;

  configuredUserId = null;

  try {
    await Purchases.logOut();
  } catch {
    // ignore
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (Platform.OS !== "ios") return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchaseRevenueCatPackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  return await Purchases.restorePurchases();
}