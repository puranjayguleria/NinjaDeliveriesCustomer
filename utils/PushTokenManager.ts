// utils/PushTokenManager.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const LAST_PROMPT_KEY = "lastPushPrompt";      //  ➜ AsyncStorage
const PROMPT_COOLDOWN_HOURS = 24;              //  ➜ re-ask after a day

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId || "FALLBACK_ID";

export const ensurePushTokenSynced = async () => {
  const user = auth().currentUser;
  if (!user || Platform.OS === "web") return;

  /* 1️⃣ check / request permission ------------------------------------ */
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    // show your in-app rationale once every 24 h
    await maybePromptForPermission();

    // actually trigger the system prompt
    ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return;            // user still said “No”
  }

  /* 2️⃣ fetch current token ------------------------------------------- */
  const { data: token } =
    await Notifications.getExpoPushTokenAsync({ projectId });

  /* 3️⃣ write if changed ---------------------------------------------- */
  const docRef = firestore().collection("users").doc(user.uid);
  const snap   = await docRef.get();
  if (snap.exists && snap.data()?.expoPushToken === token) return;

  await docRef.set({ expoPushToken: token }, { merge: true });
};
/* ---------- helper: prompt logic ---------- */
const hoursSince = (iso: string) =>
  (Date.now() - new Date(iso).valueOf()) / 3_600_000;

const maybePromptForPermission = async () => {
  const last = await AsyncStorage.getItem(LAST_PROMPT_KEY);
  if (last && hoursSince(last) < PROMPT_COOLDOWN_HOURS) return; // cool-down

  // 👉  Show *your* in-app modal here – keep it UI-agnostic
  globalThis?.showNotificationPermissionModal?.();              // call into UI

  await AsyncStorage.setItem(LAST_PROMPT_KEY, new Date().toISOString());
};
