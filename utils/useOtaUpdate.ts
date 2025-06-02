import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { Alert, AppState } from "react-native";
import Constants from "expo-constants";

export function useOtaUpdate() {
  const [checking, setChecking] = useState(true);

  // Only run OTA checks in storeClient or standalone builds
  const env = Constants.executionEnvironment;
  const isProduction = env === "storeClient" || env === "standalone";

  async function check() {
    if (!isProduction) {
      console.log(`[OTA] skipping update check in ${env} environment`);
      setChecking(false);
      return;
    }

    try {
      const { isAvailable } = await Updates.checkForUpdateAsync();
      if (!isAvailable) {
        setChecking(false);
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert(
        "Update available",
        "We’ve added new goodies! Restart now?",
        [
          { text: "Later", style: "cancel" },
          { text: "Restart", onPress: () => Updates.reloadAsync() },
        ]
      );
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
