import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

export default function ServiceEndScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { totalMinutes, company, serviceTitle, issueTitle, bookingId } = route.params || {};

  const handleGiveRating = () => {
    navigation.navigate("TrackBooking", {
      bookingId,
    });
  };

  return (
    <View style={styles.container}>
      {/* Success Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#6D28D9" />
      </View>

      {/* Header */}
      <Text style={styles.header}>Service Completed ✅</Text>
      <Text style={styles.subText}>Thank you for using our service</Text>

      {/* Service Details */}
      <View style={styles.box}>
        {company?.name && (
          <>
            <Text style={styles.label}>Company</Text>
            <Text style={styles.value}>{company.name}</Text>
          </>
        )}

        {serviceTitle && (
          <>
            <Text style={styles.label}>Service Type</Text>
            <Text style={styles.value}>{serviceTitle}</Text>
          </>
        )}

        {totalMinutes && (
          <>
            <Text style={styles.label}>Total Duration</Text>
            <Text style={styles.value}>{totalMinutes} minutes</Text>
          </>
        )}
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.8}
        onPress={handleGiveRating}
      >
        <Ionicons name="star" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.btnText}>Give Rating & Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipBtn}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("ServicesHome" as never)}
      >
        <Text style={styles.skipBtnText}>Skip for Now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    color: "#111",
    marginBottom: 6,
  },
  subText: {
    textAlign: "center",
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 24,
  },
  box: {
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    padding: 16,
    marginVertical: 20,
  },
  label: {
    marginTop: 12,
    color: "#888",
    fontWeight: "700",
    fontSize: 12,
  },
  value: {
    marginTop: 4,
    fontWeight: "900",
    fontSize: 15,
    color: "#111",
  },
  btn: {
    marginTop: 20,
    backgroundColor: "#6D28D9",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  skipBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#DDD",
    alignItems: "center",
  },
  skipBtnText: {
    color: "#666",
    fontWeight: "700",
    fontSize: 16,
  },
});
