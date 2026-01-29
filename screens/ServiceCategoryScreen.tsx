import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceIssue } from "../services/firestoreService";

export default function ServiceCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, categoryId } = route.params;

  // ✅ Multi-select states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch issues from Firestore
  useEffect(() => {
    fetchServiceIssues();
  }, [categoryId]);

  const fetchServiceIssues = async () => {
    try {
      setLoading(true);
      const fetchedIssues = await FirestoreService.getServiceIssues(categoryId);
      
      // Add "Other Issue" option at the end
      const issuesWithOther = [
        ...fetchedIssues,
        { 
          id: 'other', 
          name: 'Other Issue', 
          categoryMasterId: categoryId, 
          isActive: true 
        }
      ];
      
      setIssues(issuesWithOther);
    } catch (error) {
      console.error('Error fetching service issues:', error);
      // Set empty array on error - no demo data
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Remove the old hardcoded issues logic and replace with dynamic data
  const displayedIssues = useMemo(() => {
    if (!issues || !Array.isArray(issues)) return [];
    if (showAll) return issues;
    return issues.slice(0, 5);
  }, [issues, showAll]);

  const hasMoreItems = issues.length > 5;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const updated = prev.filter((x) => x !== id);

        // if Other removed => clear text
        if (id === "other") setOtherText("");

        return updated;
      } else {
        return [...prev, id];
      }
    });
  };

  const isOtherSelected = selectedIds.includes("other");

  const selectedIssueTitles = useMemo(() => {
    if (!issues || !Array.isArray(issues)) return [];
    
    const list = issues
      .filter((x) => selectedIds.includes(x.id))
      .map((x) => x.name);

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
    const selectedIssuesObjects = issues.filter(i => selectedIds.includes(i.id));

    navigation.navigate("CompanySelection", {
      serviceTitle,
      categoryId,
      issues: selectedIssueTitles,
      selectedIssueIds: selectedIds, // Pass the actual issue IDs
      selectedIssues: selectedIssuesObjects, // pass actual issue objects (with price)
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
            <Text style={styles.title}>{item.name}</Text>
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
    return (
      <View>
        {/* View More Button */}
        {hasMoreItems && !showAll && (
          <TouchableOpacity 
            style={styles.viewMoreBtn} 
            onPress={() => setShowAll(true)}
          >
            <Text style={styles.viewMoreText}>View More Services</Text>
          </TouchableOpacity>
        )}
        
        {/* Show Less Button */}
        {showAll && hasMoreItems && (
          <TouchableOpacity 
            style={styles.viewLessBtn} 
            onPress={() => setShowAll(false)}
          >
            <Text style={styles.viewLessText}>Show Less</Text>
          </TouchableOpacity>
        )}

        {/* Other Issue Input */}
        {isOtherSelected && (
          <View style={styles.otherBox}>
            <Text style={styles.otherTitle}>Describe Other Issue</Text>
            <TextInput
              value={otherText}
              onChangeText={setOtherText}
              placeholder="Write your issue..."
              style={styles.input}
              multiline
            />
          </View>
        )}
        
        <View style={{ height: 80 }} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{serviceTitle} Services</Text>
      <Text style={styles.subHeader}>Select your issues (multiple allowed)</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      ) : (
        <FlatList
          style={{ marginTop: 14 }}
          data={displayedIssues}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListFooterComponent={ListFooter}
          contentContainerStyle={{ paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchServiceIssues}
        />
      )}

      <TouchableOpacity 
        style={[styles.btn, loading && styles.btnDisabled]} 
        onPress={onContinue}
        disabled={loading}
      >
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

  viewMoreBtn: {
    backgroundColor: "#f8faff",
    borderWidth: 1,
    borderColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
  },

  viewMoreText: {
    color: "#2563eb",
    textAlign: "center",
    fontWeight: "500",
    fontSize: 15,
    letterSpacing: -0.2,
  },

  viewLessBtn: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
  },

  viewLessText: {
    color: "#64748b",
    textAlign: "center",
    fontWeight: "400",
    fontSize: 14,
    letterSpacing: -0.1,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },

  btnDisabled: {
    opacity: 0.6,
  },
});
