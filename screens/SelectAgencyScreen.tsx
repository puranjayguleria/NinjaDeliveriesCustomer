import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

const AGENCIES = [
  {
    id: "1",
    name: "Ninja Verified Technician",
    rating: 4.8,
    experience: "5+ yrs",
    price: 199,
  },
  {
    id: "2",
    name: "Quick Fix Expert",
    rating: 4.6,
    experience: "3+ yrs",
    price: 249,
  },
  {
    id: "3",
    name: "Home Repair Pro",
    rating: 4.7,
    experience: "4+ yrs",
    price: 299,
  },
];

export default function SelectAgencyScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issues, company, date, time } = route.params;

  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const selectedAgency = AGENCIES.find((x) => x.id === selectedAgencyId);

  const onContinue = () => {
    if (!selectedAgency) return;

    // ✅ Auto bookingId generate
    const bookingId = "BK" + Date.now();

    // ✅ amount = selected agency price (advance amount)
    const amount = selectedAgency.price;

    navigation.navigate("Payment", {
      bookingId,
      amount,
      serviceTitle,
      issues,
      company,
      agency: selectedAgency,
      date,
      time,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Agency</Text>

      {/* Top Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{serviceTitle}</Text>

        {company?.name ? (
          <Text style={styles.companyText}>
            Company: {company.name} • ₹{company.price}
          </Text>
        ) : null}

        <Text style={styles.slotText}>
          Slot: {date} • {time}
        </Text>

        {/* Selected Issues */}
        {Array.isArray(issues) && issues.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.infoSub}>Selected Issues:</Text>

            <ScrollView
              style={{ maxHeight: 80 }}
              showsVerticalScrollIndicator={false}
            >
              {issues.map((x: string, i: number) => (
                <Text key={i} style={styles.issueLine}>
                  • {x}
                </Text>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Agency List */}
      <FlatList
        style={{ marginTop: 14 }}
        data={AGENCIES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = item.id === selectedAgencyId;

          return (
            <TouchableOpacity
              style={[styles.card, active && styles.cardActive]}
              activeOpacity={0.9}
              onPress={() => setSelectedAgencyId(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.sub}>
                  ⭐ {item.rating} • {item.experience}
                </Text>
                <Text style={styles.price}>Starting ₹{item.price}</Text>
              </View>

              {active ? (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              ) : (
                <Text style={styles.selectText}>Select</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.confirmBtn, !selectedAgency && { opacity: 0.5 }]}
          disabled={!selectedAgency}
          activeOpacity={0.9}
          onPress={onContinue}
        >
          <Text style={styles.confirmText}>Continue to Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "900" },

  infoCard: {
    marginTop: 12,
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
  },
  infoTitle: { fontSize: 14, fontWeight: "900", color: "#111" },

  companyText: {
    marginTop: 6,
    fontSize: 12,
    color: "#4C1D95",
    fontWeight: "800",
  },

  slotText: {
    marginTop: 6,
    fontSize: 12,
    color: "#111",
    fontWeight: "800",
  },

  infoSub: { marginTop: 6, fontSize: 12, color: "#666", fontWeight: "800" },

  issueLine: {
    marginTop: 4,
    fontSize: 12,
    color: "#111",
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardActive: {
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#6D28D9",
  },

  title: { fontSize: 14, fontWeight: "900", color: "#111" },
  sub: { marginTop: 6, fontSize: 12, color: "#666", fontWeight: "700" },
  price: { marginTop: 6, fontSize: 12, color: "#111", fontWeight: "900" },

  selectText: {
    fontWeight: "900",
    color: "#6D28D9",
    fontSize: 12,
  },

  selectedBadge: {
    backgroundColor: "#6D28D9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedBadgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },

  confirmBtn: {
    backgroundColor: "#6D28D9",
    paddingVertical: 14,
    borderRadius: 16,
  },
  confirmText: {
    color: "white",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 14,
  },
});
