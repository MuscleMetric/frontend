import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type PushRegistrationResult = {
  granted: boolean;
  status: Notifications.PermissionStatus | "undetermined";
  expoPushToken: string | null;
};

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return {
      granted: false,
      status: "undetermined",
      expoPushToken: null,
    };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return {
      granted: false,
      status: finalStatus,
      expoPushToken: null,
    };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Missing EAS projectId for push token registration.");
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return {
    granted: true,
    status: finalStatus,
    expoPushToken: tokenResponse.data,
  };
}