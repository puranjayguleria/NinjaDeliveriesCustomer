import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceCompany } from "../services/firestoreService";

export default function CompanySelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<ServiceCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const { serviceTitle, categoryId, issues, selectedIssueIds } = route.params;

  // Fetch companies from Firestore based on selected issues
  useEffect(() => {
    fetchServiceCompanies();
  }, [selectedIssueIds]);

  const fetchServiceCompanies = async () => {
    try {
      setLoading(true);
      let fetchedCompanies: ServiceCompany[];
      
      if (selectedIssueIds && selectedIssueIds.length > 0) {
        // Fetch companies that provide the specific selected services
        fetchedCompanies = await FirestoreService.getCompaniesByServiceIssues(selectedIssueIds);
      } else if (categoryId) {
        // Fetch companies that provide services in this category
        fetchedCompanies = await FirestoreService.getCompaniesByCategory(categoryId);
      } else {
        // Fallback to all companies
        fetchedCompanies = await FirestoreService.getServiceCompanies();
      }
      
      setCompanies(fetchedCompanies);
    } catch (error) {
      console.error('Error fetching service companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const selectCompany = () => {
    if (!selectedCompany) return;
    
    navigation.navigate("SelectDateTime", {
      serviceTitle,
      categoryId,
      issues,
      company: selectedCompany,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.header}>Select Service Provider</Text>
        <Text style={styles.subHeader}>
          {selectedIssueIds && selectedIssueIds.length > 0 
            ? `Showing providers for your selected services (${companies.length} available)`
            : "Choose from verified professionals"
          }
        </Text>
      </View>

      {/* Service Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{serviceTitle} Service</Text>
        
        <View style={styles.issuesSection}>
          <Text style={styles.issuesTitle}>Selected Issues:</Text>
          <ScrollView 
            style={styles.issuesScroll}
            showsVerticalScrollIndicator={false}
          >
            {Array.isArray(issues) && issues.length > 0 ? (
              issues.map((issue: string, index: number) => (
                <View key={index} style={styles.issueTag}>
                  <Text style={styles.issueText}>{issue}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noIssuesText}>No issues selected</Text>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Companies List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading service providers...</Text>
        </View>
      ) : companies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Service Providers Found</Text>
          <Text style={styles.emptyText}>
            No companies currently provide the selected services in your area. 
            Please try selecting different services or contact support.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchServiceCompanies()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedCompanyId;
            
            return (
              <TouchableOpacity
                style={[styles.companyCard, isSelected && styles.companyCardSelected]}
                activeOpacity={0.7}
                onPress={() => setSelectedCompanyId(item.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={styles.nameRow}>
                      <Text style={styles.companyName}>{item.companyName}</Text>
                      {item.isActive && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>✓ Active</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.ownerRow}>
                      <Text style={styles.ownerName}>Owner: {item.ownerName}</Text>
                    </View>
                    
                    <View style={styles.contactRow}>
                      <Text style={styles.phone}>📞 {item.phone}</Text>
                      <Text style={styles.zone}>📍 {item.deliveryZoneName}</Text>
                    </View>
                    
                    <View style={styles.businessRow}>
                      <Text style={styles.businessType}>Service Type: {item.businessType}</Text>
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedText}>Selected</Text>
                      </View>
                    ) : (
                      <Text style={styles.selectText}>Select</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchServiceCompanies}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedCompany && (
        <View style={styles.bottomBar}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedCompanyName}>{selectedCompany.companyName}</Text>
            <Text style={styles.selectedDetails}>Owner: {selectedCompany.ownerName} • {selectedCompany.phone}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.7}
            onPress={selectCompany}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafbfc" 
  },

  // Header Section
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  backButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "500",
  },

  header: { 
    fontSize: 28, 
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.6,
    marginBottom: 8,
  },

  subHeader: { 
    color: "#64748b", 
    fontSize: 16, 
    fontWeight: "400",
    lineHeight: 24,
  },

  // Info Card
  infoCard: {
    backgroundColor: "white",
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 24,
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
    letterSpacing: -0.3,
    marginBottom: 16,
  },

  issuesSection: {
    marginTop: 8,
  },

  issuesTitle: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "500",
    marginBottom: 12,
  },

  issuesScroll: {
    maxHeight: 120,
  },

  issueTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: "flex-start",
  },

  issueText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  noIssuesText: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
  },

  // Company Cards
  listContent: {
    paddingBottom: 120,
  },

  companyCard: {
    backgroundColor: "white",
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    padding: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  companyCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#f8faff",
    elevation: 1,
    shadowOpacity: 0.08,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  cardLeft: {
    flex: 1,
    marginRight: 16,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },

  companyName: {
    fontSize: 18,
    fontWeight: "500",
    color: "#0f172a",
    letterSpacing: -0.3,
    marginRight: 12,
  },

  verifiedBadge: {
    backgroundColor: "#dcfdf7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  verifiedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#065f46",
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  rating: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginRight: 12,
  },

  experience: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  ownerRow: {
    marginBottom: 8,
  },

  ownerName: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },

  phone: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    marginRight: 16,
  },

  zone: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  businessRow: {
    marginBottom: 8,
  },

  businessType: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
    textTransform: "capitalize",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  price: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  time: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
    marginLeft: 8,
  },

  cardRight: {
    alignItems: "center",
  },

  selectText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "500",
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

  selectedText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },

  specialtiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  specialtyTag: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  specialtyText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  // Bottom Action Bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectedInfo: {
    flex: 1,
    marginRight: 16,
  },

  selectedCompanyName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  selectedPrice: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  selectedDetails: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
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

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    paddingVertical: 64,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },

  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },

  continueBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  continueText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
});
