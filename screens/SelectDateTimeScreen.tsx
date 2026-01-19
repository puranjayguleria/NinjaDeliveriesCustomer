import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function SelectDateTimeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issueTitle } = route.params;

  const [date, setDate] = useState("Today");
  const [time, setTime] = useState("1:00 PM - 3:00 PM");

  const slots = [
    "9:00 AM - 11:00 AM",
    "11:00 AM - 1:00 PM",
    "1:00 PM - 3:00 PM",
    "3:00 PM - 5:00 PM",
    "5:00 PM - 7:00 PM",
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Date & Time</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{serviceTitle}</Text>
        <Text style={styles.infoSub}>{issueTitle}</Text>
      </View>

      {/* Date pills */}
      <View style={styles.pillRow}>
        {["Today", "Tomorrow"].map((d) => {
          const active = date === d;
          return (
            <TouchableOpacity
              key={d}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setDate(d)}
              activeOpacity={0.9}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Time slots */}
      <FlatList
        style={{ marginTop: 12 }}
        data={slots}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const active = time === item;
          return (
            <TouchableOpacity
              style={[styles.slotCard, active && styles.slotCardActive]}
              onPress={() => setTime(item)}
              activeOpacity={0.9}
            >
              <Text style={[styles.slotText, active && styles.slotTextActive]}>
                {item}
              </Text>
              {active && <Text style={styles.selectedTag}>Selected</Text>}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Confirm Button */}
      <TouchableOpacity
        style={styles.confirmBtn}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("SelectAgency", {
            serviceTitle,
            issueTitle,
            date,
            time,
          })
        }
      >
        <Text style={styles.confirmText}>Confirm Slot</Text>
      </TouchableOpacity>
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
  infoSub: { marginTop: 6, fontSize: 12, color: "#666", fontWeight: "600" },

  pillRow: { flexDirection: "row", gap: 10, marginTop: 14 },

  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#e5e5e5",
  },
  pillActive: { backgroundColor: "#6D28D9" },

  pillText: { fontWeight: "800", color: "#111", fontSize: 12 },
  pillTextActive: { color: "white" },

  slotCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f6f6f6",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotCardActive: { backgroundColor: "#F3E8FF", borderWidth: 1, borderColor: "#6D28D9" },

  slotText: { fontSize: 13, fontWeight: "800", color: "#111" },
  slotTextActive: { color: "#4C1D95" },

  selectedTag: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6D28D9",
  },

  confirmBtn: {
    marginTop: 10,
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
