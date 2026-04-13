import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  onBannerPress: () => void;
  hasLocation: boolean;
  onDismiss?: () => void;
};

export default function PromotionalFoodBannerModal({ onBannerPress, hasLocation, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (onDismiss) onDismiss();
  }, [onDismiss]);

  const handleBannerPress = useCallback(() => {
    setVisible(false);
    onBannerPress();
  }, [onBannerPress]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {/* Stop touch propagation so tapping card doesn't dismiss */}
        <Pressable style={styles.card} onPress={handleBannerPress}>
          <Image
            source={require("../assets/food_banner.png")}
            style={styles.image}
            resizeMode="stretch"
          />

          {/* Close button — stops propagation so it only dismisses */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={(e) => { e.stopPropagation(); dismiss(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={30} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    aspectRatio: 1024 / 1536,   // exact image ratio — no cropping, no gaps
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 12 },
    }),
  },
  image: {
    width: "100%",
    height: "100%",
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
  },
});
