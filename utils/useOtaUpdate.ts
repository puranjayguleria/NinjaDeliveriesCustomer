import { useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import { Alert, AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";

export function useOtaUpdate() {
  const [checking, setChecking] = useState(true);
  const disabledRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  const openStoreListing = async () => {
    // NOTE: Android supports market:// deep link. iOS needs the App Store app-id URL.
    const androidPackage = Constants.expoConfig?.android?.package || "com.ninjadeliveries.customer";
    const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier || "com.ninjadeliveries.customer";

    const androidUrl = `market://details?id=${androidPackage}`;
    const androidWebUrl = `https://play.google.com/store/apps/details?id=${androidPackage}`;

    // Apple numeric App Store ID (from the App Store URL: .../idXXXXXXXXXX)
    const APPLE_APP_ID = "6742682497";
    const iosUrl = APPLE_APP_ID
      ? `itms-apps://apps.apple.com/app/id${APPLE_APP_ID}`
      : `itms-apps://apps.apple.com/in/search?term=${encodeURIComponent(iosBundleId)}`;

    try {
      if (Platform.OS === "android") {
        const can = await Linking.canOpenURL(androidUrl);
        await Linking.openURL(can ? androidUrl : androidWebUrl);
        return;
      }
      await Linking.openURL(iosUrl);
    } catch (e) {
      console.log("[OTA] Failed to open store listing:", e);
    }
  };

  async function check() {
    // NOTE: We intentionally don't gate OTA checks by executionEnvironment.
    // EAS builds can report different environments; gating here can cause users
    // to miss critical updates.

    try {
      if (disabledRef.current) {
        setChecking(false);
        return;
      }

      const isDevelopmentJs = typeof __DEV__ !== "undefined" && __DEV__ === true;
      const updateId = (Updates as any)?.updateId;
      const isUpdatesRuntimeAvailable = Updates.isEnabled && updateId != null;

      if (isDevelopmentJs || !isUpdatesRuntimeAvailable) {
        setChecking(false);
        return;
      }

      // Special case: users on the old runtime (1.0.3) should be forced to move to the
      // latest store build. We can't force-install a store build via OTA, but we can
      // block the app and instruct users clearly.
      const runtimeVersion = (Updates as any)?.runtimeVersion;
      const isRuntime103 = String(runtimeVersion || "").trim() === "1.0.3";

      // Updates.isEnabled is already checked via isUpdatesRuntimeAvailable above.

      const now = Date.now();
      if (inFlightRef.current) return;
      if (now - lastCheckAtRef.current < 30_000) return;
      lastCheckAtRef.current = now;
      inFlightRef.current = true;

      const { isAvailable } = await Updates.checkForUpdateAsync();

      // If we have an OTA available, fetch it. Avoid auto-reloading in normal flows
      // because it can feel like the app "crashed" (sudden restart).
      if (isAvailable) {
        await Updates.fetchUpdateAsync();
        if (isRuntime103) {
          await Updates.reloadAsync();
          return;
        }

        disabledRef.current = true;
        Alert.alert(
          "Update available",
          "A new update is ready. Restart the app to apply it now?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart now",
              onPress: () => {
                void Updates.reloadAsync();
              },
            },
          ]
        );
        return;
      }

      // No OTA available. If this is runtime 1.0.3, block and tell the user to update.
      if (isRuntime103) {
        Alert.alert(
          "Update required",
          "A new version of Ninja Deliveries is available. Please update the app from the App Store / Play Store to continue using it.",
          [{ text: "OK", onPress: openStoreListing }],
          { cancelable: false }
        );
      }

      if (!isAvailable) {
        setChecking(false);
        return;
      }
    } catch (e) {
      const msg = String((e as any)?.message || e || "");
      const lower = msg.toLowerCase();
      if (
        lower.includes("not supported in development builds") ||
        lower.includes("expo-updates is not enabled") ||
        lower.includes("updates is not enabled")
      ) {
        disabledRef.current = true;
        setChecking(false);
        return;
      }
      console.log("[OTA] Update check failed:", e);
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);

  return checking;
}
