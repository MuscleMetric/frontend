import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "";

export async function configureRevenueCat(appUserId?: string | null) {
  if (!REVENUECAT_API_KEY) {
    throw new Error("Missing EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY");
  }

  Purchases.setLogLevel(LOG_LEVEL.DEBUG);

  if (appUserId) {
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: appUserId,
    });
    return;
  }

  await Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
  });
}

export async function logoutRevenueCat() {
  await Purchases.logOut();
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function getRevenueCatOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchaseRevenueCatPackage(pkg: PurchasesPackage) {
  return Purchases.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases() {
  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}