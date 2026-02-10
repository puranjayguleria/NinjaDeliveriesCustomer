import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { Alert, AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";

export function useOtaUpdate() {
  const [checking, setChecking] = useState(true);

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
      // Special case: users on the old runtime (1.0.3) should be forced to move to the
      // latest store build. We can't force-install a store build via OTA, but we can
      // block the app and instruct users clearly.
  const runtimeVersion = (Updates as any)?.runtimeVersion;
      const isRuntime103 = String(runtimeVersion || "").trim() === "1.0.3";

      const { isAvailable } = await Updates.checkForUpdateAsync();

      // If we have an OTA available, fetch it and reload immediately.
      // For runtime 1.0.3 this is especially important so users get the "update required"
      // messaging without needing to press anything.
      if (isAvailable) {
        await Updates.fetchUpdateAsync();
        // Auto-reload to apply the update right away.
        await Updates.reloadAsync();
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
      console.log("[OTA] Update check failed:", e);
    } finally {
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
