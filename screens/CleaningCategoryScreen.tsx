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
  | "GENDER"
  | "ROOMS"
  | "SLOT"
  | "COMPANY"
  | "START"
  | "OTP"
  | "END"
  | "REVIEW";

export default function CleaningCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle } = route.params; // "Cleaning"

  const [step, setStep] = useState<Step>("GENDER");

  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [rooms, setRooms] = useState<number>(1);
  const [slot, setSlot] = useState<string>("");
  const [company, setCompany] = useState<any>(null);
  const [otp, setOtp] = useState("");
  const [rating, setRating] = useState(5);

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

  const companies = useMemo(
    () => [
      { id: "1", name: "Ninja Cleaning", basePrice: 299 },
      { id: "2", name: "Sparkle Pro", basePrice: 349 },
      { id: "3", name: "Home Shine Expert", basePrice: 399 },
    ],
    []
  );

  const resetAll = () => {
    setStep("GENDER");
    setGender("");
    setRooms(1);
    setSlot("");
    setCompany(null);
    setOtp("");
    setRating(5);
  };

  const getAmount = () => {
    if (!company) return 0;
    return company.basePrice * rooms;
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

  const renderGenderStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Cleaner (M/F)</Text>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setGender("Male");
          setStep("ROOMS");
        }}
      >
        <Text style={styles.title}>Male</Text>
        <Text style={styles.sub}>Select male cleaner</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          setGender("Female");
          setStep("ROOMS");
        }}
      >
        <Text style={styles.title}>Female</Text>
        <Text style={styles.sub}>Select female cleaner</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRoomsStep = () => (
    <View>
      <Text style={styles.stepTitle}>No. of Rooms</Text>
      <Text style={styles.grayText}>Cleaner: {gender}</Text>

      <View style={styles.roomRow}>
        {[1, 2, 3, 4, 5].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roomBox, rooms === r ? styles.roomActive : null]}
            onPress={() => setRooms(r)}
          >
            <Text style={{ fontWeight: "900" }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => setStep("SLOT")}>
        <Text style={styles.btnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSlotStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Slot</Text>
      <Text style={styles.grayText}>Rooms: {rooms}</Text>

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
              setStep("COMPANY"); // ✅ slot ke baad company
            }}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>Tap to select</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderCompanyStep = () => (
    <View>
      <Text style={styles.stepTitle}>Select Company</Text>
      <Text style={styles.grayText}>
        {gender} • {rooms} Rooms • {slot}
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
              setStep("START");
            }}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.sub}>
              ₹{item.basePrice}/room • Total: ₹{item.basePrice * rooms}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderStartStep = () => (
    <View>
      <Text style={styles.stepTitle}>Booking Summary</Text>

      <View style={styles.box}>
        <Text style={styles.label}>Cleaner</Text>
        <Text style={styles.value}>{gender}</Text>

        <Text style={styles.label}>Rooms</Text>
        <Text style={styles.value}>{rooms}</Text>

        <Text style={styles.label}>Slot</Text>
        <Text style={styles.value}>{slot}</Text>

        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>{company?.name}</Text>

        <Text style={styles.label}>Amount</Text>
        <Text style={styles.value}>₹{getAmount()}</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => setStep("OTP")}
      >
        <Text style={styles.btnText}>Start Cleaning</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View>
      <Text style={styles.stepTitle}>OTP Verification</Text>
      <Text style={styles.grayText}>Enter OTP to continue</Text>

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
        activeOpacity={0.9}
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
    <View>
      <Text style={styles.stepTitle}>Cleaning Completed ✅</Text>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => setStep("REVIEW")}
      >
        <Text style={styles.btnText}>Give Review</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <View>
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
        activeOpacity={0.9}
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
    if (step === "GENDER") return renderGenderStep();
    if (step === "ROOMS") return renderRoomsStep();
    if (step === "SLOT") return renderSlotStep();
    if (step === "COMPANY") return renderCompanyStep();
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

  roomRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  roomBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#f6f6f6",
    alignItems: "center",
    justifyContent: "center",
  },
  roomActive: { backgroundColor: "#FFD700" },
});
