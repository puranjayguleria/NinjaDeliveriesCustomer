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
        style={[styles.card, checked && styles.cardSelected]}
        activeOpacity={0.7}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={styles.cardContent}>
          <Image source={issueIcon} style={styles.icon} />

          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subTitle}>
              {checked ? "Selected for service" : "Tap to select this issue"}
            </Text>
          </View>
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
  
  subHeader: { 
    color: "#64748b", 
    fontSize: 16, 
    fontWeight: "400",
    paddingHorizontal: 24,
    marginBottom: 32,
    lineHeight: 24,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  cardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#f8faff",
    elevation: 1,
    shadowOpacity: 0.08,
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginRight: 16,
  },

  textContainer: {
    flex: 1,
  },

  title: { 
    fontSize: 16, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  subTitle: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
    lineHeight: 20,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  
  checkboxActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  
  checkText: { 
    color: "#fff", 
    fontWeight: "600", 
    fontSize: 12,
  },

  otherBox: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginTop: 16,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  
  otherTitle: { 
    fontWeight: "500", 
    fontSize: 16, 
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontWeight: "400",
    color: "#0f172a",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    textAlignVertical: "top",
  },

  btn: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 32,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  btnText: { 
    color: "#fff", 
    textAlign: "center", 
    fontWeight: "500",
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
