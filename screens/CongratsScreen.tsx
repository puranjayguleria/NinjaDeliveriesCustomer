import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { StackNavigationProp } from "@react-navigation/stack";
import * as Haptics from "expo-haptics";
import Loader from "@/components/VideoLoader";

type RootStackParamList = {
  Leaderboard: undefined;
  ProductsHome: undefined;
};

const { width } = Dimensions.get("window");

export default function CongratsScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { params } = useRoute();
  const { correctCount = 0, totalQuestions = 1 } = (params ?? {}) as {
    correctCount: number;
    totalQuestions: number;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<LottieView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;

  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  // Constant gradient colors
  const gradientColors = ["#FF6B8B", "#FF8E53", "#D74177"]; // Pink to orange to deep pink

  /* ---------------------------  Firestore save  --------------------------- */
  useEffect(() => {
    const saveResults = async () => {
      try {
        const userId = auth().currentUser?.uid ?? "guest";
        await firestore().collection("leaderboard").add({
          userId,
          correctCount,
          totalQuestions,
          scorePercentage,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(err);
        setError("Failed to save your results, but the score's here!");
      } finally {
        setLoading(false);
        startAnimations();
        confettiRef.current?.play();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    saveResults();
  }, [correctCount, totalQuestions, scorePercentage]);

  /* ---------------------------  Animations  --------------------------- */
  const startAnimations = () => {
    // Score counting animation
    Animated.timing(scoreAnim, {
      toValue: scorePercentage,
      duration: 1500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Main content animations
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();

    // Button animation
    Animated.timing(buttonAnim, {
      toValue: 1,
      duration: 800,
      delay: 1000,
      useNativeDriver: true,
    }).start();
  };

  /* ---------------------------  Helpers  --------------------------- */
  const getMessage = () => {
    if (scorePercentage >= 90) return "Genius Performance!";
    if (scorePercentage >= 75) return "Excellent Work!";
    if (scorePercentage >= 50) return "Good Job!";
    return "Keep Practicing!";
  };

  const getScoreColor = () => {
    if (scorePercentage >= 90) return "#990F4B"; // Wine red (deep and cool)
    if (scorePercentage >= 75) return "#C2185B"; // Raspberry red
    if (scorePercentage >= 50) return "#E91E63"; // Cool pinkish red
    return "#B4134E"; // Deep magenta red
  };

  const getMedalIcon = () => {
    if (scorePercentage >= 90) return "emoji-events"; // 🏆 Trophy
    if (scorePercentage >= 75) return "auto-awesome"; // 2️⃣ Number two
    if (scorePercentage >= 50) return "grade"; // 1️⃣ Number one (used as 3rd place)
    return "sentiment-dissatisfied"; // ☹️ Sad face
  };

  /* ---------------------------  Loading / Error Fallbacks  --------------------------- */
  if (!params) {
    return (
      <LinearGradient colors={gradientColors} style={styles.center}>
        <Text style={styles.fallbackText}>No quiz data found.</Text>
      </LinearGradient>
    );
  }
  if (loading) {
    return (
      <LinearGradient colors={gradientColors} style={styles.center}>
        <Loader />
      </LinearGradient>
    );
  }

  /* ---------------------------  Main UI  --------------------------- */
  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Confetti Animation */}
      <LottieView
        ref={confettiRef}
        source={require("../assets/confetti.json")}
        autoPlay={false}
        loop={false}
        style={styles.confetti}
        resizeMode="cover"
      />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeValue, transform: [{ scale: scaleValue }] },
        ]}
      >
        {/* Medal Icon with Glow Effect */}
        <View style={styles.medalContainer}>
          <View
            style={[
              styles.medalGlow,
              { backgroundColor: "rgba(255,255,255,0.3)" },
            ]}
          />
          <Icon
            name={getMedalIcon()}
            size={80}
            color={getScoreColor()}
            style={styles.medalIcon}
          />
        </View>

        {/* Score Message */}
        <Text style={styles.title}>{getMessage()}</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Score Display */}
        <View style={styles.scoreContainer}>
          <Text style={styles.score}>
            {correctCount}
            <Text style={styles.scoreDivider}> / </Text>
            {totalQuestions}
          </Text>

          <Animated.Text
            style={[styles.percentage, { color: getScoreColor() }]}
          >
            {scoreAnim.interpolate({
              inputRange: [0, scorePercentage],
              outputRange: ["0%", `${scorePercentage}%`],
            })}
          </Animated.Text>
        </View>

        {/* Animated Progress Bar */}
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", `${scorePercentage}%`],
                }),
                backgroundColor: getScoreColor(),
              },
            ]}
          />
        </View>

        {/* Action Buttons */}
        <Animated.View
          style={{
            opacity: buttonAnim,
            width: "100%",
            alignItems: "center",
            transform: [
              {
                translateY: buttonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={[styles.button, { backgroundColor: getScoreColor() }]}
            onPress={() => {
              Haptics.selectionAsync();
              nav.navigate("Leaderboard");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>View Leaderboard</Text>
            <Icon
              name="leaderboard"
              size={20}
              color="#fff"
              style={styles.buttonIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              Haptics.selectionAsync();
              nav.navigate("ProductsHome");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
            <Icon
              name="shopping-cart"
              size={20}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: "Avenir-Medium",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Avenir-Medium",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  confetti: {
    position: "absolute",
    width: "120%",
    height: "120%",
    zIndex: -1,
  },
  medalContainer: {
    marginBottom: 24,
    position: "relative",
  },
  medalGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
  },
  medalIcon: {
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
    fontFamily: "Avenir-Heavy",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
    fontFamily: "Avenir-Medium",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 8,
    borderRadius: 8,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 16,
  },
  score: {
    fontSize: 42,
    fontWeight: "700",
    color: "#333",
    fontFamily: "Avenir-Black",
  },
  scoreDivider: {
    fontSize: 28,
    color: "rgba(51, 51, 51, 0.5)",
    fontFamily: "Avenir-Medium",
  },
  percentage: {
    fontSize: 32,
    fontWeight: "700",
    marginLeft: 12,
    fontFamily: "Avenir-Black",
  },
  progressBarBackground: {
    height: 12,
    width: "80%",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 6,
    marginVertical: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  button: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginVertical: 8,
    width: width * 0.8,
    maxWidth: 400,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  secondaryButton: {
    flexDirection: "row",
    backgroundColor: "#FF6B6B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginVertical: 8,
    width: width * 0.8,
    maxWidth: 400,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Avenir-Heavy",
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Avenir-Heavy",
  },
  buttonIcon: {
    marginLeft: 12,
  },
});
