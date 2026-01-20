import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceTimerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const [startTime] = useState(new Date());

  const endService = () => {
    const end = new Date();
    const diffMs = end.getTime() - startTime.getTime();
    const totalMinutes = Math.max(1, Math.floor(diffMs / 60000));

    navigation.navigate("ServiceEnd", {
      ...route.params,
      startTime: startTime.toISOString(),
      endTime: end.toISOString(),
      totalMinutes,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Service Running</Text>
      <Text style={styles.sub}>Start: {startTime.toLocaleTimeString()}</Text>

      <TouchableOpacity style={styles.btn} activeOpacity={0.9} onPress={endService}>
        <Text style={styles.btnText}>End Service</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, justifyContent: "center" },
  header: { fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub: { marginTop: 6, color: "#666", textAlign: "center", fontWeight: "600" },
  btn: { marginTop: 20, backgroundColor: "#000", padding: 14, borderRadius: 16 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
