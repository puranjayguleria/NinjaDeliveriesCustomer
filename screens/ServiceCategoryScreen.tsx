import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle } = route.params;

  // ✅ Multi-select states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  // ✅ Electrician + Plumber Issues (Different)
  const issues = useMemo(() => {
    const electricianIssues = [
      { id: "1", title: "Fan Not Working" },
      { id: "2", title: "Switchboard Repair" },
      { id: "3", title: "New Fitting Installation" },
      { id: "4", title: "Wiring & Short Circuit" },
      { id: "5", title: "MCB / Fuse Problem" },
      { id: "6", title: "Light Not Working" },
      { id: "7", title: "Socket Repair" },
      { id: "8", title: "Power Fluctuation" },
      { id: "9", title: "Inverter Connection" },
      { id: "10", title: "Geyser Repair" },
      { id: "11", title: "Door Bell Issue" },
      { id: "12", title: "AC Point Installation" },
      { id: "13", title: "TV / DTH Wiring" },
      { id: "14", title: "Earthing Issue" },
      { id: "15", title: "Ceiling Light Installation" },
      { id: "16", title: "Short Circuit Smell / Sparks" },
      { id: "17", title: "Tube Light Repair" },
      { id: "18", title: "Motor / Pump Connection" },
      { id: "19", title: "New Wiring Setup" },
      { id: "20", title: "Other Issue" },
    ];

    const plumberIssues = [
      { id: "1", title: "Tap Leakage" },
      { id: "2", title: "Pipe Leakage" },
      { id: "3", title: "Bathroom Fitting Repair" },
      { id: "4", title: "Flush Repair" },
      { id: "5", title: "Blocked Drain" },
      { id: "6", title: "Water Tank Overflow" },
      { id: "7", title: "Low Water Pressure" },
      { id: "8", title: "New Tap Installation" },
      { id: "9", title: "Sink / Basin Repair" },
      { id: "10", title: "Shower Repair / Installation" },
      { id: "11", title: "Geyser Pipe Leakage" },
      { id: "12", title: "Toilet Seat Repair" },
      { id: "13", title: "Kitchen Pipe Repair" },
      { id: "14", title: "Water Motor Connection" },
      { id: "15", title: "Bathroom Drain Cleaning" },
      { id: "16", title: "Seepage / Water Damp Issue" },
      { id: "17", title: "New Pipeline Fitting" },
      { id: "18", title: "Water Heater Connection" },
      { id: "19", title: "Main Water Line Issue" },
      { id: "20", title: "Other Issue" },
    ];

    if (serviceTitle?.toLowerCase() === "plumber") return plumberIssues;
    return electricianIssues;
  }, [serviceTitle]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const updated = prev.filter((x) => x !== id);

        // if Other removed => clear text
        if (id === "20") setOtherText("");

        return updated;
      } else {
        return [...prev, id];
      }
    });
  };

  const isOtherSelected = selectedIds.includes("20");

  const selectedIssueTitles = useMemo(() => {
    const list = issues
      .filter((x) => selectedIds.includes(x.id))
      .map((x) => x.title);

    if (isOtherSelected && otherText.trim().length > 0) {
      return list.map((t) => (t === "Other Issue" ? `Other: ${otherText}` : t));
    }
    return list;
  }, [issues, selectedIds, otherText, isOtherSelected]);

  const onContinue = () => {
    if (selectedIds.length === 0) {
      Alert.alert("Select Issue", "Please select at least 1 issue.");
      return;
    }

    if (isOtherSelected && otherText.trim().length < 3) {
      Alert.alert("Other Issue", "Please describe your issue in Other field.");
      return;
    }

    // ✅ FIRST go to company selection
    navigation.navigate("CompanySelection", {
      serviceTitle,
      issues: selectedIssueTitles,
    });
  };

  const issueIcon =
    serviceTitle?.toLowerCase() === "plumber"
      ? require("../assets/images/icon_cleaning.png")
      : require("../assets/images/icon_home_repair.png");

  const renderItem = ({ item }: any) => {
    const checked = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => toggleSelect(item.id)}
      >
        <Image source={issueIcon} style={styles.icon} />

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subTitle}>
            {checked ? "Selected" : "Tap to select"}
          </Text>
        </View>

        <View style={[styles.checkbox, checked ? styles.checkboxActive : null]}>
          {checked ? <Text style={styles.checkText}>✓</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const ListFooter = () => {
    if (!isOtherSelected) return <View style={{ height: 80 }} />;

    return (
      <View style={styles.otherBox}>
        <Text style={styles.otherTitle}>Describe Other Issue</Text>
        <TextInput
          value={otherText}
          onChangeText={setOtherText}
          placeholder="Write your issue..."
          style={styles.input}
          multiline
        />
        <View style={{ height: 80 }} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{serviceTitle} Services</Text>
      <Text style={styles.subHeader}>Select your issues (multiple allowed)</Text>

      <FlatList
        style={{ marginTop: 14 }}
        data={issues}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListFooterComponent={ListFooter}
        contentContainerStyle={{ paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.btn} onPress={onContinue}>
        <Text style={styles.btnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "900" },
  subHeader: { marginTop: 4, color: "#666", fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
  },

  title: { fontSize: 14, fontWeight: "900", color: "#111" },

  subTitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#bbb",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  checkText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  otherBox: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
  },
  otherTitle: { fontWeight: "900", fontSize: 14, color: "#111" },
  input: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    minHeight: 60,
    fontWeight: "700",
    color: "#111",
  },

  btn: {
    marginTop: 14,
    backgroundColor: "#6D28D9",
    padding: 14,
    borderRadius: 16,
  },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
