import { useCallback, useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import { Alert, AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";

export function useOtaUpdate() {
  // Non-blocking by design: app should render immediately.
  const [checking, setChecking] = useState(false);

  const lastCheckAtRef = useRef(0);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('OTA check timeout')), ms)),
    ]);
  };

  const openStoreListing = useCallback(async () => {
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
  }, []);

  const check = useCallback(async (opts?: { reason?: 'launch' | 'foreground' }) => {
    // NOTE: We intentionally don't gate OTA checks by executionEnvironment.
    // EAS builds can report different environments; gating here can cause users
    // to miss critical updates.

    try {
      // Throttle checks (foregrounding can happen frequently)
      const now = Date.now();
      const minGapMs = (opts?.reason === 'launch') ? 0 : 10 * 60 * 1000; // 10 minutes
      if (now - lastCheckAtRef.current < minGapMs) return;
      lastCheckAtRef.current = now;

      // Special case: users on the old runtime (1.0.3) should be forced to move to the
      // latest store build. We can't force-install a store build via OTA, but we can
      // block the app and instruct users clearly.
  const runtimeVersion = (Updates as any)?.runtimeVersion;
      const isRuntime103 = String(runtimeVersion || "").trim() === "1.0.3";

      const { isAvailable } = await withTimeout(Updates.checkForUpdateAsync(), 4000);

      // If we have an OTA available, fetch it and reload immediately.
      // For runtime 1.0.3 this is especially important so users get the "update required"
      // messaging without needing to press anything.
      if (isAvailable) {
        // Fetch can take time; do it without trying to block the UI.
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
  }, [openStoreListing]);

  useEffect(() => {
    check({ reason: 'launch' });
  }, [check]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check({ reason: 'foreground' });
    });
    return () => sub.remove();
  }, [check]);

  return checking;
}
