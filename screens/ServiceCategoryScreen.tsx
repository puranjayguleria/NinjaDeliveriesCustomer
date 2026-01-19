import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle } = route.params;

  const issues = [
    {
      id: "1",
      title: "Fan Not Working",
      icon: require("../assets/images/icon_home_repair.png"),
    },
    {
      id: "2",
      title: "Switchboard Repair",
      icon: require("../assets/images/icon_cleaning.png"),
    },
    {
      id: "3",
      title: "New Fitting Installation",
      icon: require("../assets/images/icon_car_bike.png"),
    },
    {
      id: "4",
      title: "Wiring & Short Circuit",
      icon: require("../assets/images/icon_home_repair.png"),
    },
    {
      id: "5",
      title: "Other Issue",
      icon: require("../assets/images/icon_cleaning.png"),
    },
  ];

  const renderItem = ({ item }: any) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("SelectDateTime", {
            serviceTitle,
            issueTitle: item.title,
          })
        }
      >
        <Image source={item.icon} style={styles.icon} />

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subTitle}>Tap to book your slot</Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{serviceTitle} Services</Text>
      <Text style={styles.subHeader}>Choose your issue</Text>

      <FlatList
        style={{ marginTop: 14 }}
        data={issues}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "900" },
  subHeader: { marginTop: 4, color: "#666", fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
  },

  subTitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },

  arrow: {
    fontSize: 22,
    fontWeight: "900",
    color: "#6D28D9",
    paddingLeft: 6,
  },
});
