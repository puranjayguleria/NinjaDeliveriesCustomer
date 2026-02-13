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
              activeOpacity={0.7}
              onPress={() => setSelectedAgencyId(item.id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
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
              </View>
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
  container: { 
    flex: 1, 
    backgroundColor: "#fafbfc",
  },

  header: { 
    fontSize: 28, 
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.6,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 8,
  },

  infoCard: {
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  
  infoTitle: { 
    fontSize: 18, 
    fontWeight: "500", 
    color: "#0f172a",
    marginBottom: 12,
    letterSpacing: -0.3,
  },

  companyText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
    marginBottom: 8,
  },

  slotText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    marginBottom: 12,
  },

  infoSub: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "500",
    marginBottom: 8,
  },

  issueLine: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "400",
    marginBottom: 4,
    paddingLeft: 8,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    marginHorizontal: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  
  cardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#f8faff",
    elevation: 1,
    shadowOpacity: 0.08,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  cardLeft: {
    flex: 1,
  },

  title: { 
    fontSize: 18, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  
  sub: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "400",
    marginBottom: 4,
  },
  
  price: { 
    fontSize: 16, 
    color: "#0f172a", 
    fontWeight: "600",
  },

  selectText: {
    fontWeight: "500",
    color: "#2563eb",
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    textAlign: "center",
    minWidth: 80,
  },

  selectedBadge: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  
  selectedBadgeText: { 
    color: "#fff", 
    fontWeight: "500", 
    fontSize: 14,
  },

  bottomBar: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  confirmBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  confirmText: {
    color: "white",
    fontWeight: "500",
    textAlign: "center",
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
