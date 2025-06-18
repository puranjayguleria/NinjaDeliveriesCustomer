import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Image,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocationContext } from "@/context/LocationContext";
import Loader from "@/components/VideoLoader";

const { width } = Dimensions.get("window");

export default function LeaderboardScreen() {
  const { location } = useLocationContext();
  const storeId = location.storeId;

  const [entries, setEntries] = useState([]);
  const [rewards, setRewards] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    firestore()
      .collection("leaderboard")
      .where("storeId", "==", storeId)
      .where("timestamp", ">=", start)
      .where("timestamp", "<=", end)
      .get()
      .then((snap) => {
        const bestByUser = new Map();
        snap.docs.forEach((d) => {
          const { userId, userName, score, timestamp } = d.data();
          const ts = timestamp.toDate();
          const prev = bestByUser.get(userId);
          if (
            !prev ||
            score > prev.score ||
            (score === prev.score && ts < prev.timestamp)
          ) {
            bestByUser.set(userId, { userId, userName, score, timestamp: ts });
          }
        });
        const arr = Array.from(bestByUser.values());
        arr.sort((a, b) =>
          b.score !== a.score ? b.score - a.score : a.timestamp - b.timestamp
        );
        setEntries(arr.slice(0, 20));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    firestore()
      .collection("rewards")
      .get()
      .then((snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const { position, image } = d.data();
          map[Number(position)] = image;
        });
        setRewards(map);
      })
      .catch(console.warn);
  }, [storeId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Loader />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >
      <Text style={styles.header}>🏆 Today's Leaderboard</Text>

      <View style={styles.treeContainer}>
        {rewards[1] && (
          <View style={[styles.rewardNode, styles.centerNode]}>
            <Text style={styles.rankEmoji}>🥇</Text>
            <Image source={{ uri: rewards[1] }} style={styles.rewardImage} />
          </View>
        )}
        {rewards[2] && (
          <View style={[styles.rewardNode, styles.leftNode]}>
            <Text style={styles.rankEmoji}>🥈</Text>
            <Image source={{ uri: rewards[2] }} style={styles.rewardImage} />
          </View>
        )}
        {rewards[3] && (
          <View style={[styles.rewardNode, styles.rightNode]}>
            <Text style={styles.rankEmoji}>🥉</Text>
            <Image source={{ uri: rewards[3] }} style={styles.rewardImage} />
          </View>
        )}
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.rankHeader}>Rank</Text>
        <Text style={styles.nameHeader}>Name</Text>
        <Text style={styles.scoreHeader}>Score</Text>
        <Text style={styles.timeHeader}>Time</Text>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>No entries for today yet.</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.row,
    index < 3 && styles.topRow,

    index >= 3 && ( (index - 3) % 2 === 0 ) && styles.altRow,
              ]}
            >
              <Text style={styles.rank}>
                {index === 0
                  ? "🥇"
                  : index === 1
                  ? "🥈"
                  : index === 2
                  ? "🥉"
                  : index + 1}
              </Text>
              <Text style={styles.name}>
                {item.userName || item.userId.slice(0, 6)}
              </Text>
              <Text style={styles.score}>{item.score}</Text>
              <Text style={styles.time}>
                {item.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2c5364",
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 24,
  },
  treeContainer: {
    height: 180,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardNode: {
    position: "absolute",
    width: 80,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 8,
  },
  centerNode: {
    top: 0,
    left: width / 2 - 40,
  },
  leftNode: {
    top: 80,
    left: width / 4 - 40,
  },
  rightNode: {
    top: 80,
    right: width / 5 - 40,
  },
  rankEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  rewardImage: {
    width: 60,
    height: 60,
    resizeMode: "contain",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 4,
    alignItems: "center",
  },
  rankHeader: {
    width: 50,
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  nameHeader: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  scoreHeader: {
    width: 60,
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  timeHeader: {
    width: 70,
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  empty: {
    fontSize: 18,
    color: "#fff",
    marginTop: 50,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "center",
    paddingHorizontal: 4,
    borderRadius: 6,
    marginVertical: 2,
  },
  altRow: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  topRow: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  rank: {
    width: 50,
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  score: {
    width: 60,
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  time: {
    width: 70,
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
  },
});
