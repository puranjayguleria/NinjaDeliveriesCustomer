import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

export default function ServiceRatingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params || {};

  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        setLoading(false);
        return;
      }

      const timestamp = new Date();
      const ratingData = {
        customerId: user.uid,
        serviceType: params.serviceTitle || "Unknown",
        issue: params.issueTitle || "Unknown",
        company: params.company?.name || "Unknown",
        rating,
        feedback: feedback.trim() || "",
        timestamp: firestore.Timestamp.fromDate(timestamp),
        createdAt: timestamp.toISOString(),
        bookingId: params.bookingId || null,
        totalMinutes: params.totalMinutes || 0,
      };

      // Save to Firestore
      await firestore()
        .collection("serviceRatings")
        .add(ratingData);

      Alert.alert("Success", "Thank you for your feedback!");
      navigation.navigate("ServicesHome" as never);
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={styles.header}>Rate Your Service</Text>
      <Text style={styles.subText}>Help us improve our service</Text>

      {/* Service Details */}
      {(params.company?.name || params.serviceTitle) && (
        <View style={styles.detailsBox}>
          {params.company?.name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Company:</Text>
              <Text style={styles.detailValue}>{params.company.name}</Text>
            </View>
          )}
          {params.serviceTitle && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service:</Text>
              <Text style={styles.detailValue}>{params.serviceTitle}</Text>
            </View>
          )}
          {params.totalMinutes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>{params.totalMinutes} minutes</Text>
            </View>
          )}
        </View>
      )}

      {/* Star Rating */}
      <View style={styles.ratingSection}>
        <Text style={styles.ratingLabel}>How would you rate your experience?</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              onPress={() => setRating(num)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={rating >= num ? "star" : "star-outline"}
                size={48}
                color={rating >= num ? "#FFD700" : "#CCCCCC"}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingValue}>
          {rating ? `${rating} out of 5 stars` : "Select a rating"}
        </Text>
      </View>

      {/* Feedback Text */}
      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackLabel}>Additional Feedback (Optional)</Text>
        <TextInput
          placeholder="Share your experience, suggestions, or concerns..."
          value={feedback}
          onChangeText={setFeedback}
          multiline
          numberOfLines={4}
          style={styles.input}
          placeholderTextColor="#999"
          editable={!loading}
        />
        <Text style={styles.charCount}>{feedback.length}/500</Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        activeOpacity={0.8}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Submit Rating</Text>
        )}
      </TouchableOpacity>

      {/* Skip Button */}
      <TouchableOpacity
        style={styles.skipBtn}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("ServicesHome" as never)}
        disabled={loading}
      >
        <Text style={styles.skipBtnText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.spacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 20,
    color: "#111",
  },
  subText: {
    marginTop: 6,
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
  detailsBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  detailLabel: {
    fontWeight: "700",
    color: "#666",
    fontSize: 13,
  },
  detailValue: {
    fontWeight: "800",
    color: "#111",
    fontSize: 13,
  },
  ratingSection: {
    marginTop: 28,
    alignItems: "center",
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginVertical: 16,
  },
  ratingValue: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#6D28D9",
  },
  feedbackSection: {
    marginTop: 28,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111",
    textAlignVertical: "top",
    fontWeight: "500",
  },
  charCount: {
    marginTop: 6,
    fontSize: 12,
    color: "#999",
    textAlign: "right",
  },
  btn: {
    marginTop: 24,
    backgroundColor: "#6D28D9",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnDisabled: {
    opacity: 0.6,
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
  spacing: {
    height: 20,
  },
});

