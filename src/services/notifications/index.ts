import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import firestore from "@react-native-firebase/firestore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerFcmToken(userId: string): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  const permission = existing === "granted" ? { status: existing } : await Notifications.requestPermissionsAsync();

  if (permission.status !== "granted") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  const pushToken = await Notifications.getDevicePushTokenAsync();
  const fcmToken = typeof pushToken.data === "string" ? pushToken.data : "";

  if (!fcmToken) {
    return;
  }

  await firestore().collection("users").doc(userId).set({ fcmToken }, { merge: true });
}

export function setupNotificationListeners(onJobCompleted: (jobId: string) => void): () => void {
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data;
    if (data?.type === "RECIPE_JOB_COMPLETED" && typeof data.jobId === "string") {
      onJobCompleted(data.jobId);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === "RECIPE_JOB_COMPLETED" && typeof data.jobId === "string") {
      onJobCompleted(data.jobId);
    }
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
