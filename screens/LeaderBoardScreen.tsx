import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocationContext } from "@/context/LocationContext";
import Loader from "@/components/VideoLoader";

type Entry = {
  userId: string;
  userName: string;
  score: number;
  timestamp: Date;
};

type Reward = {
  position: number;
  description: string;
};

const { width } = Dimensions.get("window");

export default function LeaderboardScreen() {
  const { location } = useLocationContext();
  const storeId = location.storeId;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [rewards, setRewards] = useState<Record<number, string>>({});
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
        const bestByUser = new Map<string, Entry>();
        snap.docs.forEach((d) => {
          const { userId, userName, score, timestamp } = d.data() as any;
          const ts = (timestamp as any).toDate();
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
        arr.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.timestamp.getTime() - b.timestamp.getTime();
        });
        setEntries(arr.slice(0, 20));
      })
      .catch((err) => console.error("Leaderboard load error", err))
      .finally(() => setLoading(false));

    firestore()
      .collection("rewards")
      .get()
      .then((snap) => {
        const map: Record<number, string> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          console.log("Reward doc:", data); // 👈
          const { position, description } = d.data() as Reward;
          map[Number(position)] = description;
        });
        console.log("Mapped rewards:", map); // 👈

        setRewards(map);
      })
      .catch((err) => console.warn("Rewards load error", err));
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
      <View style={styles.podiumContainer}>
        {/* 2nd Place (Left) */}
        {rewards[2] && (
          <View
            style={[
              styles.prizeContainer,
              { left: width * 0.1, bottom: 60 }, // Positioned left and slightly raised
            ]}
          >
            <Text style={styles.prizeEmoji}>🥈</Text>
            <Text style={styles.prizeLabel}>2nd</Text>
            <Text style={styles.prizeDesc}>{rewards[2]}</Text>
          </View>
        )}

        {/* 1st Place (Center) */}
        {rewards[1] && (
          <View
            style={[
              styles.prizeContainer,
              { left: width / 2 - width / 3.5 / 2, bottom: 0 }, // Centered at bottom
            ]}
          >
            <Text style={styles.prizeEmoji}>🥇</Text>
            <Text style={styles.prizeLabel}>1st</Text>
            <Text style={styles.prizeDesc}>{rewards[1]}</Text>
          </View>
        )}

        {/* 3rd Place (Right) */}
        {rewards[3] && (
          <View
            style={[
              styles.prizeContainer,
              { right: width * 0.1, bottom: 90 }, // Positioned right and raised more
            ]}
          >
            <Text style={styles.prizeEmoji}>🥉</Text>
            <Text style={styles.prizeLabel}>3rd</Text>
            <Text style={styles.prizeDesc}>{rewards[3]}</Text>
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
                index % 2 === 0 && styles.altRow,
                index < 3 && styles.topRow,
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
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center", // Changed from "space-around"
    marginBottom: 30,
    height: 200, // Increased height
    position: "relative",
    width: "100%",
  },
  prizeContainer: {
    alignItems: "center",
    position: "absolute",
    width: width / 3.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 10,
    bottom: 0,
  },
  prizeEmoji: {
    fontSize: 30,
    marginBottom: 4,
  },
  prizeLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  prizeDesc: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
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
