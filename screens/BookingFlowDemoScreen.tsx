import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

interface BookingStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: "completed" | "current" | "pending";
  timestamp?: string;
  action?: () => void;
  actionLabel?: string;
}

interface DemoBooking {
  id: string;
  service: string;
  company: string;
  technician: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  rating?: number;
  feedback?: string;
}

export default function BookingFlowDemoScreen() {
  const [demoStage, setDemoStage] = useState<
    "init" | "booking" | "tracking" | "completed" | "rated"
  >("init");

  const [bookingData, setBookingData] = useState<DemoBooking>({
    id: `DEMO-${Date.now()}`,
    service: "Electrical Repair",
    company: "Elite Services",
    technician: "Raj Kumar",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  });

  const [timeProgress, setTimeProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [firebaseData, setFirebaseData] = useState<any>(null);
  const [bookingSteps, setBookingSteps] = useState<BookingStep[]>([]);
  const [animatedValue] = useState(new Animated.Value(0));

  // Initialize demo
  useEffect(() => {
    console.log("📱 Demo stage changed to:", demoStage);
    generateBookingSteps();
  }, [demoStage]);

  // Auto-advance through statuses
  useEffect(() => {
    if (demoStage !== "tracking") return;

    // Reset animation and progress when entering tracking stage
    setTimeProgress(0);
    animatedValue.setValue(0);
    
    console.log("🟢 Starting tracking interval");
    const interval = setInterval(() => {
      setTimeProgress((prev) => {
        const next = Math.min(prev + 5, 100); // Cap at 100
        console.log("📊 Progress updated to:", next, "%");
        
        // Animate the progress bar with a smooth transition
        Animated.timing(animatedValue, {
          toValue: next,
          duration: 300,
          useNativeDriver: false,
        }).start();
        
        if (next >= 100) {
          console.log("✅ Tracking complete, advancing to completed stage");
          setDemoStage("completed");
          return 100;
        }
        updateBookingStatus(next);
        return next;
      });
    }, 1000);

    return () => {
      console.log("🛑 Clearing tracking interval");
      clearInterval(interval);
    };
  }, [demoStage, animatedValue]);

  // Generate booking steps based on stage
  const generateBookingSteps = () => {
    let steps: BookingStep[] = [];

    if (demoStage === "init") {
      steps = [
        {
          id: "service_select",
          title: "Select Service",
          description: "Choose service type and details",
          icon: "checkmark-circle",
          status: "completed",
          timestamp: "Step 1",
        },
        {
          id: "company_select",
          title: "Select Company",
          description: "Choose service provider",
          icon: "building",
          status: "completed",
          timestamp: "Step 2",
        },
        {
          id: "schedule",
          title: "Schedule Service",
          description: "Pick date and time",
          icon: "calendar",
          status: "current",
          timestamp: "Step 3",
        },
        {
          id: "payment",
          title: "Payment",
          description: "Complete payment process",
          icon: "card",
          status: "pending",
          timestamp: "Step 4",
        },
      ];
    } else if (demoStage === "booking") {
      steps = [
        {
          id: "confirmed",
          title: "Booking Confirmed",
          description: `${bookingData.service} booked with ${bookingData.company}`,
          icon: "checkmark-circle",
          status: "completed",
          timestamp: new Date(bookingData.createdAt).toLocaleTimeString(),
        },
        {
          id: "assigned",
          title: "Technician Assigned",
          description: `${bookingData.technician} assigned to your booking`,
          icon: "person-circle",
          status: "current",
          timestamp: "In Progress",
          actionLabel: "Call Technician",
        },
        {
          id: "on_the_way",
          title: "On the Way",
          description: "Technician heading to your location",
          icon: "car",
          status: "pending",
        },
        {
          id: "arrived",
          title: "Arrived",
          description: "Technician arrived at location",
          icon: "location",
          status: "pending",
        },
        {
          id: "in_progress",
          title: "Work in Progress",
          description: "Service work in progress",
          icon: "construct",
          status: "pending",
        },
        {
          id: "completed",
          title: "Service Completed",
          description: "Service work completed successfully",
          icon: "checkmark-done-circle",
          status: "pending",
        },
      ];
    } else if (demoStage === "tracking") {
      const progressSteps = [
        "confirmed",
        "assigned",
        "on_the_way",
        "arrived",
        "in_progress",
        "completed",
      ];
      const currentStepIndex = Math.floor((timeProgress / 100) * progressSteps.length);

      steps = progressSteps.map((stepId, index) => ({
        id: stepId,
        title: ["Confirmed", "Assigned", "On the Way", "Arrived", "In Progress", "Completed"][
          index
        ],
        description: [
          "Your booking is confirmed",
          "Technician assigned to your request",
          "Technician heading to your location",
          "Technician has arrived",
          "Service work is in progress",
          "Service completed successfully",
        ][index],
        icon: [
          "checkmark-circle",
          "person-circle",
          "car",
          "location",
          "construct",
          "checkmark-done-circle",
        ][index] as keyof typeof Ionicons.glyphMap,
        status:
          index < currentStepIndex ? "completed" : index === currentStepIndex ? "current" : "pending",
        timestamp:
          index < currentStepIndex
            ? `${10 + index * 5} min ago`
            : index === currentStepIndex
              ? "Now"
              : undefined,
      }));
    } else if (demoStage === "completed") {
      steps = [
        {
          id: "confirmed",
          title: "Booking Confirmed",
          description: "Service booking confirmed",
          icon: "checkmark-circle",
          status: "completed",
          timestamp: "4:00 PM",
        },
        {
          id: "assigned",
          title: "Technician Assigned",
          description: `${bookingData.technician} was assigned`,
          icon: "person-circle",
          status: "completed",
          timestamp: "4:05 PM",
        },
        {
          id: "on_the_way",
          title: "On the Way",
          description: "Technician departed for location",
          icon: "car",
          status: "completed",
          timestamp: "4:15 PM",
        },
        {
          id: "arrived",
          title: "Arrived",
          description: "Technician arrived at location",
          icon: "location",
          status: "completed",
          timestamp: "4:40 PM",
        },
        {
          id: "in_progress",
          title: "Work in Progress",
          description: "Service work started",
          icon: "construct",
          status: "completed",
          timestamp: "4:45 PM",
        },
        {
          id: "completed",
          title: "Service Completed",
          description: "✅ Service work completed successfully!",
          icon: "checkmark-done-circle",
          status: "completed",
          timestamp: "5:15 PM",
        },
      ];
    } else if (demoStage === "rated") {
      steps = [
        ...bookingSteps.slice(0, bookingSteps.length - 1),
        {
          id: "completed",
          title: "Service Completed & Rated",
          description: `Service rated ${bookingData.rating}⭐ by customer`,
          icon: "star",
          status: "completed",
          timestamp: "5:15 PM",
        },
      ];
    }

    setBookingSteps(steps);
  };

  // Update booking status during tracking
  const updateBookingStatus = (progress: number) => {
    const statuses = ["confirmed", "assigned", "on_the_way", "arrived", "in_progress", "completed"];
    const statusIndex = Math.floor((progress / 100) * statuses.length);
    const status = statuses[Math.min(statusIndex, statuses.length - 1)];

    setBookingData((prev) => ({
      ...prev,
      status,
    }));
  };

  // Save booking to Firebase
  const handleSaveToFirebase = async () => {
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        setLoading(false);
        return;
      }

      // Save booking to Firestore
      const bookingRef = await firestore().collection("serviceBookings").add({
        customerId: user.uid,
        bookingId: bookingData.id,
        service: bookingData.service,
        company: bookingData.company,
        technician: bookingData.technician,
        status: bookingData.status,
        createdAt: firestore.Timestamp.fromDate(new Date(bookingData.createdAt)),
        updatedAt: firestore.Timestamp.fromDate(new Date()),
        isDemo: true,
      });

      setFirebaseData({
        id: bookingRef.id,
        service: bookingData.service,
        saved: true,
        timestamp: new Date().toISOString(),
      });

      Alert.alert(
        "✅ Saved to Firebase",
        `Booking saved!\n\nDoc ID: ${bookingRef.id}\nService: ${bookingData.service}\nCompany: ${bookingData.company}`
      );
    } catch (error) {
      console.error("Firebase error:", error);
      Alert.alert("Error", "Failed to save booking: " + String(error));
    } finally {
      setLoading(false);
    }
  };

  // Submit rating
  const handleSubmitRating = async () => {
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        setLoading(false);
        return;
      }

      // Save rating to Firestore
      await firestore().collection("serviceRatings").add({
        customerId: user.uid,
        bookingId: bookingData.id,
        service: bookingData.service,
        company: bookingData.company,
        technician: bookingData.technician,
        rating: bookingData.rating || 5,
        feedback: bookingData.feedback || "Great service!",
        timestamp: firestore.Timestamp.fromDate(new Date()),
        createdAt: new Date().toISOString(),
      });

      setDemoStage("rated");
      Alert.alert("✅ Rating Submitted", "Thank you for your feedback!");
    } catch (error) {
      console.error("Firebase error:", error);
      Alert.alert("Error", "Failed to submit rating: " + String(error));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: "completed" | "current" | "pending"): string => {
    switch (status) {
      case "completed":
        return "#10B981";
      case "current":
        return "#3B82F6";
      case "pending":
        return "#D1D5DB";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Service Booking Demo</Text>
        <Text style={styles.headerSubtitle}>Firebase & Rating Integration</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Stage Indicator */}
        <View style={styles.stageContainer}>
          <Text style={styles.stageLabel}>Current Stage:</Text>
          <View style={[styles.stageBadge, { backgroundColor: getStatusColor("current") }]}>
            <Text style={styles.stageBadgeText}>
              {demoStage === "init"
                ? "📝 Booking"
                : demoStage === "booking"
                  ? "🎯 Assignment"
                  : demoStage === "tracking"
                    ? "🚗 Tracking"
                    : demoStage === "completed"
                      ? "✅ Complete"
                      : "⭐ Rated"}
            </Text>
          </View>
        </View>

        {/* Booking Info */}
        {demoStage !== "init" && (
          <View style={styles.infoCard}>
            <View style={styles.infRow}>
              <Text style={styles.infLabel}>Booking ID:</Text>
              <Text style={styles.infValue}>{bookingData.id}</Text>
            </View>
            <View style={styles.infRow}>
              <Text style={styles.infLabel}>Service:</Text>
              <Text style={styles.infValue}>{bookingData.service}</Text>
            </View>
            <View style={styles.infRow}>
              <Text style={styles.infLabel}>Company:</Text>
              <Text style={styles.infValue}>{bookingData.company}</Text>
            </View>
            <View style={styles.infRow}>
              <Text style={styles.infLabel}>Technician:</Text>
              <Text style={styles.infValue}>{bookingData.technician}</Text>
            </View>
            <View style={styles.infRow}>
              <Text style={styles.infLabel}>Status:</Text>
              <Text style={[styles.infValue, { color: "#10B981" }]}>
                {bookingData.status.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Progress Bar for Tracking */}
        {demoStage === "tracking" && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Service Progress</Text>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: animatedValue.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(timeProgress)}% Complete</Text>
          </View>
        )}

        {/* Timeline Steps */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>
            {demoStage === "init"
              ? "Booking Steps"
              : demoStage === "tracking"
                ? "Live Tracking"
                : "Booking Timeline"}
          </Text>

          {bookingSteps.map((step, index) => (
            <View key={step.id} style={styles.timelineStep}>
              <View style={styles.stepLine}>
                <View
                  style={[
                    styles.stepDot,
                    { backgroundColor: getStatusColor(step.status) },
                  ]}
                >
                  <Ionicons
                    name={step.icon}
                    size={16}
                    color="#fff"
                    style={{ marginTop: 2 }}
                  />
                </View>
                {index < bookingSteps.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      {
                        backgroundColor:
                          step.status === "completed" ? "#10B981" : "#D1D5DB",
                      },
                    ]}
                  />
                )}
              </View>

              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {step.timestamp && (
                    <Text style={styles.stepTime}>{step.timestamp}</Text>
                  )}
                </View>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Firebase Data Display */}
        {firebaseData && (
          <View style={styles.firebaseCard}>
            <View style={styles.firebaseHeader}>
              <Ionicons name="cloud-check" size={20} color="#10B981" />
              <Text style={styles.firebaseTitle}>Saved to Firebase ✓</Text>
            </View>
            <Text style={styles.firebaseText}>
              Document ID: {firebaseData.id.substring(0, 20)}...
            </Text>
            <Text style={styles.firebaseText}>Service: {firebaseData.service}</Text>
            <Text style={styles.firebaseText}>
              Saved: {new Date(firebaseData.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Rating Card */}
        {(demoStage === "completed" || demoStage === "rated") && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Rate This Service</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  onPress={() =>
                    setBookingData((prev) => ({
                      ...prev,
                      rating: num,
                      feedback: `Great service! Technician ${bookingData.technician} did excellent work.`,
                    }))
                  }
                >
                  <Ionicons
                    name={(bookingData.rating || 0) >= num ? "star" : "star-outline"}
                    size={40}
                    color={(bookingData.rating || 0) >= num ? "#FFD700" : "#CCCCCC"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {bookingData.rating && (
              <Text style={styles.ratingValue}>{bookingData.rating} out of 5 stars</Text>
            )}
          </View>
        )}

        {/* Feedback Textarea */}
        {(demoStage === "completed" || demoStage === "rated") && bookingData.rating && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackLabel}>Share Your Feedback</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Tell us about your experience..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={4}
              value={bookingData.feedback || ""}
              onChangeText={(text) =>
                setBookingData((prev) => ({
                  ...prev,
                  feedback: text,
                }))
              }
            />
            <Text style={styles.feedbackCounter}>
              {(bookingData.feedback || "").length}/500 characters
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          {demoStage === "init" && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setDemoStage("booking")}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
              <Text style={styles.buttonText}>Start Demo Booking</Text>
            </TouchableOpacity>
          )}

          {demoStage === "booking" && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => setDemoStage("tracking")}
              >
                <Ionicons name="play-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>Start Live Tracking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleSaveToFirebase}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Save to Firebase</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {demoStage === "tracking" && (
            <View style={styles.trackingInfo}>
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text style={styles.trackingText}>
                Auto-advancing through service stages...
              </Text>
            </View>
          )}

          {(demoStage === "completed" || demoStage === "rated") && (
            <>
              {demoStage === "completed" && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={handleSubmitRating}
                  disabled={!bookingData.rating || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="star" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Submit Rating</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {demoStage === "rated" && (
                <View style={styles.successCard}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                  <Text style={styles.successText}>Service Completed & Rated!</Text>
                  <Text style={styles.successSubtext}>
                    Booking and rating saved to Firebase
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#6366F1" }]}
                onPress={() => {
                  setDemoStage("init");
                  setTimeProgress(0);
                  setFirebaseData(null);
                  setBookingData({
                    id: `DEMO-${Date.now()}`,
                    service: "Electrical Repair",
                    company: "Elite Services",
                    technician: "Raj Kumar",
                    status: "confirmed",
                    createdAt: new Date().toISOString(),
                  });
                }}
              >
                <Ionicons name="refresh-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>Restart Demo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📚 What This Demo Shows:</Text>
          <View style={styles.infoBullet}>
            <Text style={styles.bulletPoint}>✓</Text>
            <Text style={styles.bulletText}>Complete service booking workflow</Text>
          </View>
          <View style={styles.infoBullet}>
            <Text style={styles.bulletPoint}>✓</Text>
            <Text style={styles.bulletText}>Real-time status tracking</Text>
          </View>
          <View style={styles.infoBullet}>
            <Text style={styles.bulletPoint}>✓</Text>
            <Text style={styles.bulletText}>Firebase Firestore integration</Text>
          </View>
          <View style={styles.infoBullet}>
            <Text style={styles.bulletPoint}>✓</Text>
            <Text style={styles.bulletText}>Rating and feedback system</Text>
          </View>
          <View style={styles.infoBullet}>
            <Text style={styles.bulletPoint}>✓</Text>
            <Text style={styles.bulletText}>Data persistence with timestamps</Text>
          </View>
        </View>

        <View style={styles.spacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    backgroundColor: "#6D28D9",
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  stageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  stageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stageBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6D28D9",
  },
  infRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  infLabel: {
    fontWeight: "600",
    color: "#666",
    fontSize: 13,
  },
  infValue: {
    fontWeight: "800",
    color: "#111",
    fontSize: 13,
  },
  progressContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  timelineContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
    marginBottom: 16,
  },
  timelineStep: {
    flexDirection: "row",
    marginBottom: 20,
  },
  stepLine: {
    alignItems: "center",
    marginRight: 12,
    width: 50,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepConnector: {
    width: 2,
    height: 40,
    marginTop: 8,
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },
  stepTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  stepDescription: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  firebaseCard: {
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  firebaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  firebaseTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
  },
  firebaseText: {
    fontSize: 12,
    color: "#047857",
    marginVertical: 2,
    fontFamily: "monospace",
  },
  ratingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6D28D9",
    marginTop: 12,
  },
  buttonsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  actionButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#10B981",
  },
  secondaryButton: {
    backgroundColor: "#6366F1",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  trackingInfo: {
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trackingText: {
    color: "#1E40AF",
    fontSize: 13,
    fontWeight: "600",
  },
  successCard: {
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#047857",
    marginTop: 10,
  },
  successSubtext: {
    fontSize: 12,
    color: "#059669",
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  infoBullet: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    gap: 10,
  },
  bulletPoint: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
  },
  bulletText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  feedbackContainer: {
    backgroundColor: "#f8f9ff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  feedbackInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#333",
    textAlignVertical: "top",
    marginBottom: 6,
  },
  feedbackCounter: {
    fontSize: 11,
    color: "#999",
    textAlign: "right",
  },
  spacing: {
    height: 20,
  },
});
