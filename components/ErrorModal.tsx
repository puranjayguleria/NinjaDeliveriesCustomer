import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";

type NotificationModalProps = {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;               // Renamed for clarity
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
};

const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  title,
  message,
  onClose,
  onCancel,
  confirmText = "Okay",          // Default to "Okay"
  cancelText = "Cancel",
}) => {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          {/* Circular notification icon */}
          <Image
            source={require("../assets/notify_ninja.png")}
            style={styles.image}
            resizeMode="cover"
          />

          {title && <Text style={styles.title}>{title}</Text>}
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={[styles.buttonText, styles.cancelText]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onClose}             // Use onClose for "Okay"
            >
              <Text style={[styles.buttonText, styles.confirmText]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default NotificationModal;

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    elevation: 5,
  },
  image: {
    width: 140,
    height: 140,
    borderRadius: 70,          // Half of width/height for circular appearance
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: "#444",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "flex-end",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
  },
  confirmButton: {
    backgroundColor: "#28a745",
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmText: {
    color: "#fff",
  },
  cancelText: {
    color: "#333",
  },
});
