import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

const AGENCIES = [
  {
    id: "1",
    name: "Fixit Experts",
    rating: 4.5,
    price: 299,
    verified: true,
    image: require("../assets/images/icon_home_repair.png"),
  },
  {
    id: "2",
    name: "Himalaya Repairs",
    rating: 4.3,
    price: 349,
    verified: true,
    image: require("../assets/images/icon_cleaning.png"),
  },
  {
    id: "3",
    name: "Quick Care Services",
    rating: 4.7,
    price: 399,
    verified: false,
    image: require("../assets/images/icon_car_bike.png"),
  },
];

export default function SelectAgencyScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issueTitle, date, time } = route.params;

  const renderAgency = ({ item }: any) => {
    return (
      <View style={styles.card}>
        {/* Left Image */}
        <View style={styles.leftRow}>
          <Image source={item.image} style={styles.avatar} />

          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.name}</Text>

              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>

            <Text style={styles.metaText}>
              ⭐ {item.rating} • Starts at ₹{item.price}
            </Text>

            <Text style={styles.smallText}>
              {serviceTitle} • {issueTitle}
            </Text>
          </View>
        </View>

        {/* Right Select Button */}
        <TouchableOpacity
          style={styles.selectBtn}
          activeOpacity={0.9}
          onPress={() => {
            const bookingId = "BK" + Date.now().toString().slice(-6);

            navigation.navigate("Payment", {
              bookingId,
              amount: 99,
              serviceTitle,
              issueTitle,
              date,
              time,
              agencyName: item.name,
              agencyPrice: item.price,
              agencyRating: item.rating,
            });
          }}
        >
          <Text style={styles.selectText}>Select</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select an Agency</Text>

      <Text style={styles.subHeader}>
        {serviceTitle} - {issueTitle}
      </Text>

      <Text style={styles.subHeader2}>
        {date} | {time}
      </Text>

      <FlatList
        data={AGENCIES}
        keyExtractor={(item) => item.id}
        renderItem={renderAgency}
        contentContainerStyle={{ paddingBottom: 20, marginTop: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "800" },
  subHeader: { marginTop: 6, color: "#666", fontSize: 13 },
  subHeader2: { marginTop: 2, color: "#666", fontSize: 13 },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  name: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
  },

  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
  },

  metaText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },

  smallText: {
    marginTop: 4,
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },

  selectBtn: {
    backgroundColor: "#6D28D9",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  selectText: {
    color: "white",
    fontWeight: "800",
    fontSize: 13,
  },
});
