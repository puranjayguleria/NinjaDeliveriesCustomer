import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

type Step =
  | "CAR_TYPE"
  | "NO_OF_CARS"
  | "SERVICE_TYPE"
  | "SLOT"
  | "PAY"
  | "START"
  | "OTP"
  | "END"
  | "REVIEW";

export default function CarWashCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle } = route.params; // "Car Wash"

  const [step, setStep] = useState<Step>("CAR_TYPE");

  const [carType, setCarType] = useState<string>("");
  const [noOfCars, setNoOfCars] = useState<number>(1);
  const [serviceType, setServiceType] = useState<
    "Exterior" | "Interior" | "Both" | ""
  >("");
  const [slot, setSlot] = useState<string>("");

  const [otp, setOtp] = useState("");
  const [rating, setRating] = useState(5);

  const carTypes = useMemo(
    () => [
      { id: "1", title: "2 Seater" },
      { id: "2", title: "4 Seater" },
      { id: "3", title: "6 Seater" },
      { id: "4", title: "15 Seater" },
      { id: "5", title: "20 Seater (Max)" },
    ],
    []
  );

  const slots = useMemo(
    () => [
      { id: "1", title: "09:00 AM - 10:00 AM" },
      { id: "2", title: "10:00 AM - 11:00 AM" },
      { id: "3", title: "12:00 PM - 01:00 PM" },
      { id: "4", title: "03:00 PM - 04:00 PM" },
      { id: "5", title: "05:00 PM - 06:00 PM" },
    ],
    []
  );

  const resetAll = () => {
    setStep("CAR_TYPE");
    setCarType("");
    setNoOfCars(1);
    setServiceType("");
    setSlot("");
    setOtp("");
    setRating(5);
  };

  const getPrice = () => {
    // Base price by service type
    let base = 0;
    if (serviceType === "Exterior") base = 199;
    if (serviceType === "Interior") base = 299;
    if (serviceType === "Both") base = 449;

    // Extra charge by car type
    let typeAdd = 0;
    if (carType === "2 Seater") typeAdd = 0;
    if (carType === "4 Seater") typeAdd = 50;
    if (carType === "6 Seater") typeAdd = 100;
    if (carType === "15 Seater") typeAdd = 250;
    if (carType === "20 Seater (Max)") typeAdd = 350;

    return (base + typeAdd) * noOfCars;
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

  // ---------------- STEP UI ----------------

  const renderCarTypeStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Car Type</Text>

      <FlatList
        data={carTypes}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              setCarType(item.title);
              setStep("NO_OF_CARS");
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

  const renderNoOfCarsStep = () => (
    <View>
      <Text style={styles.stepTitle}>No. of Cars</Text>
      <Text style={styles.grayText}>Car Type: {carType}</Text>

      <View style={styles.countRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.countBox, noOfCars === n ? styles.countActive : null]}
            onPress={() => setNoOfCars(n)}
          >
            <Text style={{ fontWeight: "900" }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => setStep("SERVICE_TYPE")}
      >
        <Text style={styles.btnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderServiceTypeStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Service Type</Text>
      <Text style={styles.grayText}>
        {carType} • {noOfCars} Car(s)
      </Text>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setServiceType("Exterior");
          setStep("SLOT");
        }}
      >
        <Text style={styles.title}>Exterior</Text>
        <Text style={styles.sub}>Outer wash only</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setServiceType("Interior");
          setStep("SLOT");
        }}
      >
        <Text style={styles.title}>Interior</Text>
        <Text style={styles.sub}>Inner cleaning only</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setServiceType("Both");
          setStep("SLOT");
        }}
      >
        <Text style={styles.title}>Both</Text>
        <Text style={styles.sub}>Interior + Exterior</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSlotStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Slot</Text>
      <Text style={styles.grayText}>
        {carType} • {noOfCars} • {serviceType}
      </Text>

      <FlatList
        style={{ marginTop: 12 }}
        data={slots}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              setSlot(item.title);
              setStep("PAY");
            }}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>Tap to select</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderPayStep = () => (
    <View>
      <Text style={styles.stepTitle}>Checkout & Pay</Text>

      <View style={styles.box}>
        <Text style={styles.label}>Car Type</Text>
        <Text style={styles.value}>{carType}</Text>

        <Text style={styles.label}>No. of Cars</Text>
        <Text style={styles.value}>{noOfCars}</Text>

        <Text style={styles.label}>Service Type</Text>
        <Text style={styles.value}>{serviceType}</Text>

        <Text style={styles.label}>Slot</Text>
        <Text style={styles.value}>{slot}</Text>

        <Text style={styles.label}>Total Amount</Text>
        <Text style={styles.value}>₹{getPrice()}</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => setStep("START")}
      >
        <Text style={styles.btnText}>Pay & Start</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStartStep = () => (
    <View style={{ marginTop: 30 }}>
      <Text style={styles.stepTitle}>Car Wash Started 🚗</Text>
      <Text style={styles.grayText}>OTP verification required</Text>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("OTP")}>
        <Text style={styles.btnText}>Enter OTP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.stepTitle}>Enter OTP</Text>
      <Text style={styles.grayText}>Ask washer for OTP</Text>

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
      <Text style={styles.stepTitle}>Car Wash Completed ✅</Text>

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
    if (step === "CAR_TYPE") return renderCarTypeStep();
    if (step === "NO_OF_CARS") return renderNoOfCarsStep();
    if (step === "SERVICE_TYPE") return renderServiceTypeStep();
    if (step === "SLOT") return renderSlotStep();
    if (step === "PAY") return renderPayStep();
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

  box: { backgroundColor: "#f6f6f6", borderRadius: 18, padding: 14, marginTop: 6 },
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

  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  countBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#f6f6f6",
    alignItems: "center",
    justifyContent: "center",
  },
  countActive: { backgroundColor: "#FFD700" },
});
