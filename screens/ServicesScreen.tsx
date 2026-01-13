// screens/ServicesScreen.tsx
import React from "react";
import { View, Text, Button } from "react-native";

export default function ServicesScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Services
      </Text>

      {/* Temporary placeholders – later you replace these with real features */}
      <Button title="Book Service" onPress={() => {}} />
      <View style={{ height: 10 }} />
      <Button title="My Services" onPress={() => {}} />
      <View style={{ height: 10 }} />
      <Button title="Support" onPress={() => {}} />
    </View>
  );
}
