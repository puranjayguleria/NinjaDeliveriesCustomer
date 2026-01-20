import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

type Step =
  | "SHIFT"
  | "GENDER"
  | "COMPANY"
  | "CHECKOUT"
  | "START"
  | "OTP"
  | "END"
  | "REVIEW";

export default function DailyWagesCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle } = route.params; // "Daily Wages"

  const [step, setStep] = useState<Step>("SHIFT");

  const [shift, setShift] = useState<"Half Day" | "Full Day" | "">("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [company, setCompany] = useState<any>(null);

  const [otp, setOtp] = useState("");
  const [rating, setRating] = useState(5);

  const companies = useMemo(
    () => [
      { id: "1", name: "Ninja Workers", halfDay: 499, fullDay: 899 },
      { id: "2", name: "Quick Staff", halfDay: 549, fullDay: 999 },
      { id: "3", name: "Daily Help Pro", halfDay: 599, fullDay: 1099 },
    ],
    []
  );

  const resetAll = () => {
    setStep("SHIFT");
    setShift("");
    setGender("");
    setCompany(null);
    setOtp("");
    setRating(5);
  };

  const getAmount = () => {
    if (!company || !shift) return 0;
    return shift === "Half Day" ? company.halfDay : company.fullDay;
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

  const renderShiftStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Shift</Text>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setShift("Half Day");
          setStep("GENDER");
        }}
      >
        <Text style={styles.title}>Half Day</Text>
        <Text style={styles.sub}>Approx 4 Hours</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setShift("Full Day");
          setStep("GENDER");
        }}
      >
        <Text style={styles.title}>Full Day</Text>
        <Text style={styles.sub}>Approx 8 Hours</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGenderStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Worker (M/F)</Text>
      <Text style={styles.grayText}>Shift: {shift}</Text>

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
        {shift} • {gender}
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
              setStep("CHECKOUT");
            }}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.sub}>
              Half Day ₹{item.halfDay} • Full Day ₹{item.fullDay}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderCheckoutStep = () => (
    <View>
      <Text style={styles.stepTitle}>Checkout</Text>

      <View style={styles.box}>
        <Text style={styles.label}>Shift</Text>
        <Text style={styles.value}>{shift}</Text>

        <Text style={styles.label}>Worker</Text>
        <Text style={styles.value}>{gender}</Text>

        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>{company?.name}</Text>

        <Text style={styles.label}>Amount</Text>
        <Text style={styles.value}>₹{getAmount()}</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => setStep("START")}
      >
        <Text style={styles.btnText}>Confirm & Start</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStartStep = () => (
    <View style={{ marginTop: 30 }}>
      <Text style={styles.stepTitle}>Work Started</Text>
      <Text style={styles.grayText}>OTP verification required</Text>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("OTP")}>
        <Text style={styles.btnText}>Enter OTP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.stepTitle}>Enter OTP</Text>
      <Text style={styles.grayText}>Ask worker for OTP</Text>

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
      <Text style={styles.stepTitle}>Work Completed ✅</Text>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("REVIEW")}>
        <Text style={styles.btnText}>Give Rating</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.stepTitle}>Rating</Text>
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
    if (step === "SHIFT") return renderShiftStep();
    if (step === "GENDER") return renderGenderStep();
    if (step === "COMPANY") return renderCompanyStep();
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

  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
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
