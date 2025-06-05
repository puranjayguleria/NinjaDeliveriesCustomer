import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const CongratsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { correctCount, totalQuestions } = route.params || {};
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const { width, height } = useWindowDimensions();
  const stylesDynamic = dynamicStyles(width, height);

  const performanceText = () => {
    if (percentage >= 90) return "Outstanding! You're a true expert!";
    if (percentage >= 75) return "Excellent work! You really know your stuff!";
    if (percentage >= 60) return "Good job! You're making great progress!";
    if (percentage >= 50) return "Not bad! Keep practicing to improve!";
    return "Keep trying! You'll get better with more practice!";
  };

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scoreBounce = useRef(new Animated.Value(1)).current;
  const confettiRef = useRef<ConfettiCannon>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start(() => {
      Animated.sequence([
        Animated.timing(scoreBounce, {
          toValue: 1.15,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scoreBounce, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });

    confettiRef.current?.start?.();
  }, []);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.backgroundContainer}>
      <LinearGradient
        colors={["#0F2027", "#203A43", "#2C5364"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: width / 2, y: -20 }}
          fadeOut
          autoStart={false}
          fallSpeed={3500}
          colors={["#FFD700", "#FFA500", "#FF6347", "#00FFFF", "#7CFC00"]}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              stylesDynamic.card,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.trophyContainer}>
              <View style={styles.trophyGlow}>
                <Ionicons
                  name="trophy"
                  size={height < 600 ? 70 : 90}
                  color="#FFD700"
                />
              </View>
              <View style={styles.circleDecoration} />
            </View>

            <Text style={[styles.title, stylesDynamic.title]}>
              Congratulations!
            </Text>
            <Text style={[styles.subtitle, stylesDynamic.subtitle]}>
              Quiz Completed!
            </Text>

            <Animated.Text
              style={[
                styles.score,
                stylesDynamic.score,
                { transform: [{ scale: scoreBounce }] },
              ]}
            >
              {correctCount}
              <Text style={styles.scoreSmall}> / {totalQuestions}</Text>
            </Animated.Text>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${percentage}%` }]} />
            </View>

            <Text style={styles.percentageText}>{percentage}%</Text>

            <Text style={styles.message}>{performanceText()}</Text>

            {/* Back to Home */}
            <Animated.View
              style={{ transform: [{ scale: buttonScale }], width: "100%" }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  stylesDynamic.button,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                android_ripple={{ color: "rgba(255,255,255,0.2)" }}
                onPressIn={animateButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate("ProductsHome");
                }}
              >
                <LinearGradient
                  colors={["#00c6ff", "#0072ff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Back to Home</Text>
                  <Ionicons
                    name="home"
                    size={20}
                    color="white"
                    style={styles.buttonIcon}
                  />
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Leaderboard */}
            <Animated.View
              style={{ transform: [{ scale: buttonScale }], width: "100%" }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    opacity: pressed ? 0.7 : 1,
                    marginTop: 16,
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    borderColor: "#00c6ff",
                  },
                ]}
                android_ripple={{ color: "rgba(0,198,255,0.2)" }}
                onPressIn={animateButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate("Leaderboard");
                }}
              >
                <View
                  style={[
                    styles.buttonGradient,
                    { backgroundColor: "transparent" },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: "#00c6ff" }]}>
                    View Leaderboard
                  </Text>
                  <Ionicons
                    name="podium"
                    size={20}
                    color="#00c6ff"
                    style={styles.buttonIcon}
                  />
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </ScrollView>

        {/* Decorative Circles */}
        <View
          style={[
            styles.decorativeCircle,
            { left: width * 0.1, top: height * 0.1 },
          ]}
        />
        <View
          style={[
            styles.decorativeCircle,
            { right: width * 0.15, bottom: height * 0.2 },
          ]}
        />
      </LinearGradient>
    </View>
  );
};

export default CongratsScreen;

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    width: "100%",
  },
  gradient: {
    flex: 1,
    width: "100%",
    minHeight: Dimensions.get("window").height,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  trophyContainer: {
    position: "relative",
    marginBottom: 20,
  },
  trophyGlow: {
    shadowColor: "#ffd700",
    shadowRadius: 30,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 2,
  },
  circleDecoration: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    top: -15,
    left: -15,
    zIndex: 1,
  },
  title: {
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    textAlign: "center",
  },
  score: {
    fontWeight: "bold",
    color: "#FFD700",
    marginTop: 10,
    textAlign: "center",
  },
  scoreSmall: {
    fontSize: 24,
    color: "rgba(255,255,255,0.7)",
  },
  progressBarContainer: {
    width: "80%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    marginTop: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#00c6ff",
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 18,
    color: "#00c6ff",
    fontWeight: "700",
    marginTop: 8,
  },
  message: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 20,
    textAlign: "center",
    fontWeight: Platform.OS === "ios" ? "500" : "400",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  button: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    elevation: 3,
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 28,
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 10,
  },
  decorativeCircle: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(0, 198, 255, 0.05)",
    zIndex: -1,
  },
});

// ✅ Responsive Style Overrides
const dynamicStyles = (width, height) => ({
  card: {
    width: Math.min(width * 0.9, 500),
    paddingVertical: height < 600 ? 24 : 36,
    paddingHorizontal: width < 350 ? 20 : 32,
    marginVertical: 20,
  },
  title: {
    fontSize: height < 600 ? 28 : 34,
  },
  subtitle: {
    fontSize: height < 600 ? 18 : 22,
  },
  score: {
    fontSize: height < 600 ? 32 : 38,
  },
  button: {
    marginTop: height < 600 ? 20 : 30,
  },
});
