import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WELCOME_SHOWN_KEY = "welcomeServicesShown_v1";

type Props = {
  onGoToServices: () => void;
};

export default function WelcomeServicesOnceModal({ onGoToServices }: Props) {
  const [visible, setVisible] = useState(false);
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const imageHeight = Math.min(Math.round(screenWidth * 1.15), Math.round(screenHeight * 0.55));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WELCOME_SHOWN_KEY);
        const hasShown = raw === "true";
        if (mounted && !hasShown) setVisible(true);
      } catch {
        // If storage fails, still show once for this session.
        if (mounted) setVisible(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const closeAndPersist = useCallback(async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SHOWN_KEY, "true");
    } catch {
      // ignore
    }
    setVisible(false);
  }, []);

  const handleGoToServices = useCallback(async () => {
    await closeAndPersist();
    onGoToServices();
  }, [closeAndPersist, onGoToServices]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeAndPersist}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.hero}>
            <Image
              source={require("../assets/welcomeservices.jpeg")}
              style={[styles.image, { height: imageHeight }]}
              resizeMode="contain"
            />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>
              Book services quickly. Pick your slot, choose your provider, and checkout.
            </Text>

            <TouchableOpacity
              onPress={handleGoToServices}
              style={[styles.button, styles.primary]}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryText}>Go to Services</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={closeAndPersist}
              style={[styles.button, styles.secondary]}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 18,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  hero: {
    backgroundColor: "#f8fafc",
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  image: {
    width: "100%",
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
  button: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  primary: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  secondary: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingVertical: 8,
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
});
