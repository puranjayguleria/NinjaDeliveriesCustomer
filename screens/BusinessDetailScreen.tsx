// BusinessDetailScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Linking,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import Loader from "@/components/VideoLoader";

interface Business {
  id: string;
  name: string;
  type: string;
  phoneNumber: string;
  inTime: string;
  outTime: string;
  isAvailable: boolean;
  image?: string;
  menuImages?: string[];
}

interface BusinessDetailScreenProps {
  route: {
    params: {
      businessId: string;
    };
  };
}

/**
 * Converts time from "HH:MM" (24-hour) format to "h:MM AM/PM" (12-hour) format.
 * @param time - Time string in "HH:MM" format.
 * @returns Time string in "h:MM AM/PM" format.
 */
const formatTime = (time: string): string => {
  const [hourStr, minute] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour; // Adjust midnight and noon
  return `${hour}:${minute} ${ampm}`;
};

const BusinessDetailScreen: React.FC<BusinessDetailScreenProps> = ({
  route,
}) => {
  const { businessId } = route.params;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusinessDetails = async () => {
      try {
        const doc = await firestore()
          .collection("businessDetails")
          .doc(businessId)
          .get();

        if (doc.exists) {
          const data = doc.data();
          setBusiness({
            id: doc.id,
            name: data?.name,
            type: data?.type,
            phoneNumber: data?.phoneNumber,
            inTime: data?.inTime,
            outTime: data?.outTime,
            isAvailable: data?.isAvailable,
            image: data?.image,
            menuImages: data?.menuImages || [],
          });
        } else {
          Alert.alert("Error", "Business not found.");
        }
      } catch (error) {
        console.error("Error fetching business details:", error);
        Alert.alert("Error", "Failed to load business details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessDetails();
  }, [businessId]);

  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) {
      Alert.alert("Error", "No phone number provided.");
      return;
    }

    const formattedNumber = phoneNumber.replace(/[^0-9+]/g, ""); // Remove invalid characters
    Linking.openURL(`tel:${formattedNumber}`).catch(() =>
      Alert.alert("Error", "Unable to make the call.")
    );
  };

  const handleMenuImagePress = (image: string) => {
    setSelectedImage(image);
    setIsImageModalVisible(true);
  };

  const closeImageModal = () => {
    setIsImageModalVisible(false);
    setSelectedImage(null);
  };

  const handleAvailabilityPress = () => {
    if (!business) return;

    Alert.alert(
      business.isAvailable ? "Business is Open" : "Business is Closed",
      `Working Hours: ${formatTime(business.inTime)} - ${formatTime(
        business.outTime
      )}`,
      [{ text: "OK" }]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Business not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Business Image */}
      <Image
        source={{
          uri: business.image || "https://via.placeholder.com/400x200",
        }}
        style={styles.bannerImage}
      />

      {/* Business Info */}
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{business.name}</Text>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCall(business.phoneNumber)}
            accessible={true}
            accessibilityLabel="Call Business"
          >
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.type}>{business.type}</Text>
        <TouchableOpacity onPress={handleAvailabilityPress}>
          <Text
            style={[
              styles.availability,
              { color: business.isAvailable ? "green" : "red" },
            ]}
          >
            {business.isAvailable ? "Open Now" : "Closed"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.workingHours}>
          Working Hours: {formatTime(business.inTime)} -{" "}
          {formatTime(business.outTime)}
        </Text>
      </View>

      {/* Menu Images Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Menu</Text>
        {business.menuImages && business.menuImages.length > 0 ? (
          <FlatList
            data={business.menuImages}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleMenuImagePress(item)}>
                <Image source={{ uri: item }} style={styles.menuImage} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.menuList}
          />
        ) : (
          <Text style={styles.noImageText}>No menu images available</Text>
        )}
      </View>

      {/* Menu Image Modal */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={closeImageModal}
            accessible={true}
            accessibilityLabel="Close Image"
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
  },
  bannerImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoContainer: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  callButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  type: {
    fontSize: 18,
    color: "#555",
    marginBottom: 5,
  },
  availability: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  workingHours: {
    fontSize: 14,
    color: "#777",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  menuList: {
    paddingVertical: 10,
  },
  menuImage: {
    width: 150,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
  },
  noImageText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
  },
  fullscreenImage: {
    width: "90%",
    height: "70%",
    resizeMode: "contain",
  },
});

export default BusinessDetailScreen;
