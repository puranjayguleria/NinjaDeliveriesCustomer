import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

type Step =
  | "SERVICE"
  | "GENDER"
  | "COMPANY"
  | "PACKAGE"
  | "CHECKOUT"
  | "START"
  | "OTP"
  | "END"
  | "REVIEW";

export default function HealthCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle } = route.params;

  const [step, setStep] = useState<Step>("SERVICE");

  // selections
  const [healthType, setHealthType] = useState<string>("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [company, setCompany] = useState<any>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [otp, setOtp] = useState("");
  const [rating, setRating] = useState(5);

  const healthServices = useMemo(
    () => [
      { id: "1", title: "Physio" },
      { id: "2", title: "Gym" },
      { id: "3", title: "Meditation" },
      { id: "4", title: "Yoga" },
    ],
    []
  );

  const companies = useMemo(
    () => [
      { id: "1", name: "Ninja Health", price: 399 },
      { id: "2", name: "Fit Care Pro", price: 499 },
      { id: "3", name: "Wellness Home", price: 599 },
    ],
    []
  );

  const packages = useMemo(
    () => [
      { id: "1", name: "Basic Package (30 min)", price: 499 },
      { id: "2", name: "Standard Package (45 min)", price: 699 },
      { id: "3", name: "Premium Package (60 min)", price: 899 },
    ],
    []
  );

  const resetAll = () => {
    setStep("SERVICE");
    setHealthType("");
    setGender("");
    setCompany(null);
    setSelectedPackage(null);
    setOtp("");
    setRating(5);
  };

  const HeaderTop = () => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.header}>{serviceTitle}</Text>
      <Text style={styles.subHeader}>Step: {step}</Text>

      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.smallBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.smallBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallBtn} onPress={resetAll}>
          <Text style={styles.smallBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ----------------- STEP UI -----------------
  const renderServiceStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Health Service</Text>

      <FlatList
        data={healthServices}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              setHealthType(item.title);
              setStep("GENDER");
            }}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>Tap to continue</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );

  const renderGenderStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Gender</Text>
      <Text style={styles.grayText}>Service: {healthType}</Text>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setGender("Male");
          setStep("COMPANY");
        }}
      >
        <Text style={styles.title}>Male</Text>
        <Text style={styles.sub}>Tap to continue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setGender("Female");
          setStep("COMPANY");
        }}
      >
        <Text style={styles.title}>Female</Text>
        <Text style={styles.sub}>Tap to continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompanyStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Company</Text>
      <Text style={styles.grayText}>
        {healthType} • {gender}
      </Text>

      <FlatList
        style={{ marginTop: 12 }}
        data={companies}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              setCompany(item);
              setStep("PACKAGE");
            }}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.sub}>Starting ₹{item.price}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderPackageStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Package</Text>
      <Text style={styles.grayText}>
        {healthType} • {gender} • {company?.name}
      </Text>

      <FlatList
        style={{ marginTop: 12 }}
        data={packages}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              setSelectedPackage(item);
              setStep("CHECKOUT");
            }}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.sub}>₹{item.price}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderCheckoutStep = () => (
    <View>
      <Text style={styles.stepTitle}>Checkout</Text>

      <View style={styles.box}>
        <Text style={styles.label}>Service</Text>
        <Text style={styles.value}>{healthType}</Text>

        <Text style={styles.label}>Gender</Text>
        <Text style={styles.value}>{gender}</Text>

        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>{company?.name}</Text>

        <Text style={styles.label}>Package</Text>
        <Text style={styles.value}>{selectedPackage?.name}</Text>

        <Text style={styles.label}>Amount</Text>
        <Text style={styles.value}>₹{selectedPackage?.price}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("START")}>
        <Text style={styles.btnText}>Confirm & Start</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStartStep = () => (
    <View style={{ marginTop: 30 }}>
      <Text style={styles.stepTitle}>Service Started</Text>
      <Text style={styles.grayText}>OTP verification required</Text>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("OTP")}>
        <Text style={styles.btnText}>Enter OTP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.stepTitle}>Enter OTP</Text>
      <Text style={styles.grayText}>Ask technician for OTP</Text>

      <TextInput
        value={otp}
        onChangeText={setOtp}
        placeholder="1234"
        keyboardType="number-pad"
        maxLength={6}
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          if (!otp || otp.length < 4) {
            Alert.alert("Invalid OTP", "Please enter valid OTP (min 4 digits)");
            return;
          }
          setStep("END");
        }}
      >
        <Text style={styles.btnText}>Verify OTP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEndStep = () => (
    <View style={{ marginTop: 30 }}>
      <Text style={styles.stepTitle}>Service Completed ✅</Text>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("REVIEW")}>
        <Text style={styles.btnText}>Give Review</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.stepTitle}>Review</Text>
      <Text style={styles.grayText}>Rate your experience</Text>

      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.star, rating >= r ? styles.starActive : null]}
            onPress={() => setRating(r)}
          >
            <Text style={{ fontWeight: "900" }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          Alert.alert("Submitted", `Thanks! Rating: ${rating}/5`);
          navigation.goBack();
        }}
      >
        <Text style={styles.btnText}>Submit</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    if (step === "SERVICE") return renderServiceStep();
    if (step === "GENDER") return renderGenderStep();
    if (step === "COMPANY") return renderCompanyStep();
    if (step === "PACKAGE") return renderPackageStep();
    if (step === "CHECKOUT") return renderCheckoutStep();
    if (step === "START") return renderStartStep();
    if (step === "OTP") return renderOtpStep();
    if (step === "END") return renderEndStep();
    return renderReviewStep();
  };

  return (
    <View style={styles.container}>
      <HeaderTop />
      {renderStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "900" },
  subHeader: { marginTop: 4, color: "#666", fontSize: 13, fontWeight: "600" },

  topRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  smallBtn: {
    backgroundColor: "#f6f6f6",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  smallBtnText: { fontWeight: "900", color: "#111" },

  stepTitle: { fontSize: 18, fontWeight: "900", marginBottom: 10 },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },

  title: { fontSize: 14, fontWeight: "900", color: "#111" },
  sub: { marginTop: 6, fontSize: 12, color: "#666", fontWeight: "600" },
  grayText: { color: "#666", fontWeight: "600", marginBottom: 10 },

  box: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginTop: 6,
  },
  label: { marginTop: 10, color: "#666", fontWeight: "700", fontSize: 12 },
  value: { marginTop: 4, fontWeight: "900", fontSize: 14, color: "#111" },

  btn: { marginTop: 18, backgroundColor: "#6D28D9", padding: 14, borderRadius: 16 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },

  input: {
    marginTop: 12,
    backgroundColor: "#f6f6f6",
    borderRadius: 16,
    padding: 14,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  ratingRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 14 },
  star: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f6f6f6",
    alignItems: "center",
    justifyContent: "center",
  },
  starActive: { backgroundColor: "#FFD700" },
});
