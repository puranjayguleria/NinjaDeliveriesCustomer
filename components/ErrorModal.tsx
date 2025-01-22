import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";

type ErrorModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

const ErrorModal: React.FC<ErrorModalProps> = ({ visible, message, onClose }) => {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <Image source={require("../assets/sad_ninja.png")} style={styles.image} />
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Okay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ErrorModal;

const styles = StyleSheet.create({
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent dark background for the entire modal
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: "80%",
      backgroundColor: "#FDEBD0", // Skin-colored background for the modal container
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
      elevation: 5,
    },
    image: {
      width: 140, // Increased width
      height: 140, // Increased height
      marginBottom: 20,
    },
    message: {
      fontSize: 18, // Slightly larger font size for better readability
      color: "#333", // Dark color for better contrast
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 26, // Increased line height for better text spacing
      fontWeight: "500", // Medium weight for better emphasis
    },
    button: {
      backgroundColor: "#28a745", // Green button
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 10,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
  });
  
  
