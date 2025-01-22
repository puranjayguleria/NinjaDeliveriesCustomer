// BusinessDirectoryScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
  Image,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";

interface Business {
  id: string;
  name: string;
  type: string;
  phoneNumber: string;
  inTime: string;
  outTime: string;
  isAvailable: boolean;
  image?: string;
}

interface BusinessDirectoryScreenProps {
  navigation: any;
}

const BusinessDirectoryScreen: React.FC<BusinessDirectoryScreenProps> = ({ navigation }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchName, setSearchName] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("businessDetails")
      .onSnapshot(
        (querySnapshot) => {
          const businessList: Business[] = [];
          const typeSet = new Set<string>();

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const inTime = data.inTime || "00:00";
            const outTime = data.outTime || "23:59";

            const currentTime = new Date();
            const [inHour, inMin] = inTime.split(":").map(Number);
            const [outHour, outMin] = outTime.split(":").map(Number);

            const inDate = new Date();
            inDate.setHours(inHour, inMin, 0, 0);
            const outDate = new Date();
            outDate.setHours(outHour, outMin, 0, 0);

            const isOpen = currentTime >= inDate && currentTime <= outDate;

            typeSet.add(data.type);

            businessList.push({
              id: doc.id,
              name: data.name,
              type: data.type,
              phoneNumber: data.phoneNumber,
              inTime,
              outTime,
              isAvailable: isOpen,
              image: data.image,
            });
          });

          businessList.sort(
            (a, b) => Number(b.isAvailable) - Number(a.isAvailable)
          );

          setBusinesses(businessList);
          setFilteredBusinesses(businessList);
          setTypes(Array.from(typeSet));
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching business details:", error);
          Alert.alert("Error", "Failed to load businesses. Please try again.");
        }
      );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = businesses;

    if (searchName) {
      filtered = filtered.filter((business) =>
        business.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (selectedType) {
      filtered = filtered.filter((business) => business.type === selectedType);
    }

    if (showActiveOnly) {
      filtered = filtered.filter((business) => business.isAvailable);
    }

    setFilteredBusinesses(filtered);
  }, [searchName, selectedType, showActiveOnly, businesses]);

  const handleNavigateToDetails = (businessId: string) => {
    navigation.navigate("BusinessDetail", { businessId });
  };

  const renderBusiness = ({ item }: { item: Business }) => (
    <TouchableOpacity
      onPress={() => handleNavigateToDetails(item.id)}
      style={[styles.card, !item.isAvailable && styles.cardDisabled]}
      disabled={!item.isAvailable}
      accessible={true}
      accessibilityLabel={`${item.name} ${item.isAvailable ? "is open" : "is closed"}`}
    >
      {/* Business Image */}
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.businessImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Ionicons name="business" size={40} color="#ccc" />
        </View>
      )}

      <View style={styles.businessInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.type}>{item.type}</Text>
        <View style={styles.statusRow}>
          <Ionicons
            name={item.isAvailable ? "checkmark-circle" : "close-circle"}
            size={16}
            color={item.isAvailable ? "green" : "red"}
          />
          <Text
            style={[
              styles.statusText,
              { color: item.isAvailable ? "green" : "red" },
            ]}
          >
            {item.isAvailable ? "Open Now" : "Closed"}
          </Text>
        </View>
      </View>

      <Ionicons
        name="arrow-forward"
        size={24}
        color={item.isAvailable ? "#4CAF50" : "#ccc"}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Informational Message */}
      <View style={styles.infoMessageContainer}>
        <Text style={styles.infoMessage}>
          Please call the business directly to place your order and make
          payments. Ninja Deliveries will pick up your order and deliver it to
          your drop-off location.
        </Text>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name..."
          value={searchName}
          onChangeText={setSearchName}
        />
      </View>

      <Picker
        selectedValue={selectedType}
        onValueChange={(itemValue) => setSelectedType(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="All Types" value="" />
        {types.map((type) => (
          <Picker.Item key={type} label={type} value={type} />
        ))}
      </Picker>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowActiveOnly((prev) => !prev)}
        accessible={true}
        accessibilityLabel={showActiveOnly ? "Show All Businesses" : "Show Active Only Businesses"}
      >
        <Text style={styles.filterButtonText}>
          {showActiveOnly ? "Show All" : "Show Active Only"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={filteredBusinesses}
        keyExtractor={(item) => item.id}
        renderItem={renderBusiness}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? Constants.statusBarHeight : 0,
    backgroundColor: "#fff",
  },
  infoMessageContainer: {
    padding: 16,
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
    margin: 16,
    borderLeftWidth: 5,
    borderLeftColor: "#FFCC00",
  },
  infoMessage: {
    fontSize: 14,
    color: "#856404",
    lineHeight: 20,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  searchInput: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  picker: {
    height: 50,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  filterButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  filterButtonText: {
    color: "#fff",
    textAlign: "center",
  },
  list: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDisabled: {
    backgroundColor: "#f0f0f0",
    opacity: 0.6,
  },
  businessImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  businessInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  type: {
    fontSize: 14,
    color: "#777",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default BusinessDirectoryScreen;
