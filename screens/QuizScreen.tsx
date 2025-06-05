// screens/QuizScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  Easing,
  BackHandler,
} from "react-native";
import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "@react-native-firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";

import { getAuth } from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { useLocationContext } from "@/context/LocationContext";
import LinearGradient from "react-native-linear-gradient";
import { format, isBefore, isAfter, parse } from "date-fns";
import Loader from "@/components/VideoLoader";

// Custom color palette
const COLORS = {
  primary: "#00b4a0", // Teal green
  secondary: "#00d2c7", // Light teal
  accent: "#ff6f91", // Coral pink for contrast
  background: "#ffffff", // White background
  card: "#f6fffe", // Very light mint for cards
  text: "#003b36", // Deep teal for text
  textLight: "#6c8a87", // Soft teal-gray
  success: "#28c76f",
  warning: "#ff9f43",
  error: "#ea5455",
  timer: "#ff6b6b",
  buttonText: "#ffffff",
};

const { width } = Dimensions.get("window");
const TIMER_DURATION = 15;

function isToday(ts: Timestamp) {
  const d = ts.toDate(),
    n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export default function QuizScreen() {
  const nav = useNavigation();
  const { location } = useLocationContext();
  const storeId = location.storeId!;
  const db = getFirestore(getApp());
  const auth = getAuth(getApp());
  const user = auth.currentUser!;

  // UI state
  const [loading, setLoading] = useState(true);
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Quiz state
  const [questions, setQuestions] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation for option press
  const optionScale = useRef(new Animated.Value(1)).current;

  // Guard to only finish once
  const finishedRef = useRef(false);

  //Color of the options
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  //Quizz timing
  const [isQuizTime, setIsQuizTime] = useState(false);
  const [startTimeStr, setStartTimeStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");

  useEffect(() => {
    const checkTime = async () => {
      const now = new Date();

      try {
        const querySnapshot = await getDocs(collection(db, "quizzes"));

        if (querySnapshot.empty) {
          console.warn("No quiz document found");
          return;
        }

        const data = querySnapshot.docs[0].data();

        // ✅ Validate presence and format of 'from' and 'to'
        if (typeof data.from !== "string" || typeof data.to !== "string") {
          console.warn("Quiz time fields are not strings:", data);
          return;
        }

        // ✅ Parse using 'now' as base date
        const start = parse(data.from, "HH:mm", now);
        const end = parse(data.to, "HH:mm", now);

        if (isNaN(start) || isNaN(end)) {
          console.warn("Invalid time format in Firestore");
          return;
        }

        setStartTimeStr(format(start, "h:mm a")); // e.g., 12:00 PM
        setEndTimeStr(format(end, "h:mm a"));
        const withinTime = isAfter(now, start) && isBefore(now, end);
        setIsQuizTime(withinTime);
      } catch (err) {
        console.error("Error fetching quiz time:", err);
      }
    };

    checkTime();
  }, []);

  // Pulse animation for timer when low
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timeLeft, pulseAnim]);

  // On mount: load profile, check play-today, fetch questions
  useEffect(() => {
    (async () => {
      try {
        // 1) Load profile
        const ud = await getDoc(doc(db, "users", user.uid));
        const data = ud.data() || {};
        if (!data.name) {
          setNameModalVisible(true);
        } else {
          setDisplayName(data.name);
          setQuizStarted(true); // ✅ Allow quiz to proceed
        }

        // 2) Check if already played today
        const playedQ = query(
          collection(db, "leaderboard"),
          where("storeId", "==", storeId),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const playedSnap = await getDocs(playedQ);
        if (!playedSnap.empty && isToday(playedSnap.docs[0].data().timestamp)) {
          setLockModalVisible(true);
          return;
        }

        // 3) Fetch quiz definition
        const qzSnap = await getDocs(
          query(
            collection(db, "quizzes"),
            where("storeId", "==", storeId),
            limit(1)
          )
        );
        if (qzSnap.empty) throw new Error("No quiz configured");
        const quizRef = qzSnap.docs[0].ref;

        // 4) Fetch questions
        let qsSnap = await getDocs(
          query(
            collection(db, "questions"),
            where("quizId", "==", quizRef),
            orderBy("text")
          )
        );
        if (qsSnap.empty) {
          qsSnap = await getDocs(
            query(
              collection(db, "questions"),
              where("storeId", "==", storeId),
              orderBy("text")
            )
          );
        }
        setQuestions(qsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Could not load quiz.");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, storeId, user.uid]);

  // Save display name
  const saveName = async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert("Name Required", "Please enter your name.");
      return;
    }
    setSavingName(true);
    await setDoc(doc(db, "users", user.uid), { name }, { merge: true });
    setSavingName(false);
    setNameModalVisible(false);
    setQuizStarted(true);
  };

  // Write final leaderboard entry exactly once
  const finishQuiz = useCallback(
    async (finalScore: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      try {
        await addDoc(collection(db, "leaderboard"), {
          score: finalScore,
          correctCount: finalScore,
          totalQuestions: questions.length,
          storeId,
          timestamp: serverTimestamp(),
          userId: user.uid ?? "guest",
          userName: displayName,
          scorePercentage: Math.round((finalScore / questions.length) * 100),
        });
      } catch (error) {
        console.error("Failed to save leaderboard:", error);
        // Optional: pass an error flag to Congrats screen
      }

      nav.replace("Congrats", {
        correctCount: finalScore,
        totalQuestions: questions.length,
      });
    },
    [db, displayName, nav, questions.length, storeId, user.uid]
  );

  // Handle an answer tap with animation
  const onAnswer = useCallback(
    (optId: number) => {
      if (finishedRef.current) return;

      setSelectedOption(optId); // Track which option was selected

      // Animate the option press
      Animated.sequence([
        Animated.timing(optionScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(optionScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        const q = questions[current];
        const gotIt = optId === q.correctOptionId;
        setScore((s) => s + (gotIt ? 1 : 0));

        // Delay moving to next question to show feedback
        setTimeout(() => {
          setSelectedOption(null); // Reset selection
          if (current + 1 < questions.length) {
            setCurrent((c) => c + 1);
          } else {
            finishQuiz(score + (gotIt ? 1 : 0));
          }
        }, 1000); // 1 second delay to show feedback
      });
    },
    [current, finishQuiz, questions, score, optionScale]
  );
  //quit Midway
  const quitQuizMidway = useCallback(async () => {
    try {
      await addDoc(collection(db, "leaderboard"), {
        score: 0,
        correctCount: 0,
        totalQuestions: questions.length,
        storeId,
        timestamp: serverTimestamp(),
        userId: user.uid ?? "guest",
        userName: displayName,
        scorePercentage: 0,
        quitMidway: true, // special flag to mark quit mid quiz
      });
    } catch (error) {
      console.error("Failed to save quit midway attempt:", error);
    }
  }, [db, displayName, questions.length, storeId, user.uid]);
  // Per-question timer
  useEffect(() => {
    if (!isQuizTime || finishedRef.current || !questions.length) return;

    setTimeLeft(TIMER_DURATION);
    timerAnim.setValue(1);
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: TIMER_DURATION * 1000,
      useNativeDriver: false,
    }).start();

    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv);
          onAnswer(-1); // This is what we want to block if not isQuizTime
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [isQuizTime, current, onAnswer, questions.length, timerAnim]);

  useFocusEffect(
    React.useCallback(() => {
      if (
        isQuizTime &&
        !loading &&
        !lockModalVisible &&
        questions.length > 0 &&
        !nameModalVisible
      ) {
        const onBackPress = () => {
          Alert.alert(
            "Exit Quiz?",
            "If you exit now, you won’t be able to attempt again.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Exit",
                style: "destructive",
                onPress: async () => {
                  await quitQuizMidway();
                  nav.goBack();
                },
              },
            ]
          );
          return true; // prevent default back behavior
        };

        BackHandler.addEventListener("hardwareBackPress", onBackPress);

        return () =>
          BackHandler.removeEventListener("hardwareBackPress", onBackPress);
      }

      // If conditions not met, do nothing, so back works normally
      return undefined;
    }, [
      isQuizTime,
      loading,
      lockModalVisible,
      questions.length,
      nameModalVisible,
      quitQuizMidway,
      nav,
    ])
  );

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        style={styles.center}
      >
        <Loader />
      </LinearGradient>
    );
  }
  if (!isQuizTime) {
    return (
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        style={styles.center}
      >
        <View style={styles.timeLockedContainer}>
          <Text style={styles.timeLockedTitle}>Quiz Not Available Yet</Text>
          <Text style={styles.timeLockedText}>
            The daily quiz is only available between
          </Text>

          <View style={styles.timeDisplay}>
            <Text style={styles.timeText}>{startTimeStr}</Text>
            <Text style={styles.timeSeparator}>to</Text>
            <Text style={styles.timeText}>{endTimeStr}</Text>
          </View>

          <Text style={styles.timeLockedSubtext}>
            Please come back during these hours to participate!
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: COLORS.secondary }]}
            onPress={() => nav.goBack()}
          >
            <Text style={styles.buttonText}>Back to Store</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }
  // If user already played today, show the "already played" screen
  if (lockModalVisible) {
    return (
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        style={styles.center}
      >
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedTitle}>Daily Challenge Complete!</Text>
          <Text style={styles.lockedText}>
            You've already played today. Come back tomorrow for another chance!
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: COLORS.secondary }]}
            onPress={() => nav.goBack()}
          >
            <Text style={styles.buttonText}>Back to Store</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: COLORS.primary }]}
            onPress={() => nav.navigate("Leaderboard")}
          >
            <Text style={styles.buttonText}>View Leaderboard</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }
  if (
    isQuizTime &&
    !loading &&
    !lockModalVisible &&
    questions.length > 0 &&
    !nameModalVisible
  ) {
    return (
      <LinearGradient
        colors={[COLORS.background, "#E2E8F0"]}
        style={styles.container}
      >
        {/* Name prompt */}
        <Modal visible={nameModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.modalTitle}>Welcome to the Quiz!</Text>
              <Text style={styles.modalText}>
                Enter your name to appear on the leaderboard:
              </Text>
              <TextInput
                style={styles.modalInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={COLORS.textLight}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: COLORS.primary }]}
                onPress={saveName}
                disabled={savingName}
              >
                <Text style={styles.buttonText}>
                  {savingName ? "Saving..." : "Continue"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>

        {!isQuizTime ? (
          <View style={styles.center}>
            <Text style={styles.noQuestionsText}>
              The quiz is not active right now. Please come back between{" "}
              {startTimeStr} and {endTimeStr}.
            </Text>
          </View>
        ) : (
          <>
            {/* Timer */}
            {questions.length > 0 && (
              <View style={styles.timerRow}>
                <Animated.Text
                  style={[
                    styles.timerCount,
                    {
                      color: timeLeft <= 5 ? COLORS.timer : COLORS.text,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  {timeLeft}s
                </Animated.Text>
                <View style={styles.timerBarBg}>
                  <Animated.View
                    style={[
                      styles.timerBar,
                      {
                        width: timerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                        backgroundColor:
                          timeLeft <= 5 ? COLORS.timer : COLORS.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Question + options */}
            {questions.length > 0 ? (
              <Animated.View
                style={[
                  styles.card,
                  {
                    /* ...shadows... */
                  },
                ]}
              >
                <Text style={styles.questionNumber}>
                  Question {current + 1} of {questions.length}
                </Text>
                <Text style={styles.questionText}>
                  {questions[current].text}
                </Text>

                <View style={styles.optionsContainer}>
                  {questions[current].options.map((opt: any) => {
                    const isSelected = selectedOption === opt.id;
                    const isCorrect =
                      opt.id === questions[current].correctOptionId;
                    const showCorrect = selectedOption !== null && isCorrect;
                    const showIncorrect = isSelected && !isCorrect;

                    return (
                      <View key={opt.id} style={styles.optionWrapper}>
                        <Animated.View
                          style={{ transform: [{ scale: optionScale }] }}
                        >
                          <TouchableOpacity
                            style={[
                              styles.option,
                              showCorrect && styles.correctOption,
                              showIncorrect && styles.incorrectOption,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => onAnswer(opt.id)}
                            disabled={selectedOption !== null}
                          >
                            <View style={styles.optionContent}>
                              <Text style={styles.optionLabel}>
                                {opt.label}
                              </Text>
                              {(showCorrect || showIncorrect) && (
                                <Text style={styles.feedbackText}>
                                  {showCorrect ? "✓ Correct!" : "✗ Wrong"}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.noQuestionsText}>
                  No questions available.
                </Text>
              </View>
            )}
          </>
        )}
      </LinearGradient>
    );
  }
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "500",
  },
  optionWrapper: {
    marginVertical: 8,
  },
  option: {
    backgroundColor: "#e6f7f5",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccf0ec",
    minHeight: 80, // Increased height to accommodate feedback
    justifyContent: "center",
  },
  optionContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4, // Space between label and feedback
  },
  correctOption: {
    backgroundColor: COLORS.success + "20",
    borderColor: COLORS.success,
  },
  incorrectOption: {
    backgroundColor: COLORS.error + "20",
    borderColor: COLORS.error,
  },
  feedbackText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
  },
  // Locked screen styles
  lockedContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 25,
    width: "90%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: "center",
  },
  lockedText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 25,
    textAlign: "center",
    lineHeight: 24,
  },

  // Button styles
  button: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: COLORS.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 25,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 24,
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.textLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
    color: COLORS.text,
  },

  // Timer styles
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  timerCount: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 12,
    minWidth: 40,
    textAlign: "center",
  },
  timerBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  timerBar: {
    height: "100%",
    borderRadius: 3,
  },

  // Question card styles
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    justifyContent: "center",
  },
  questionNumber: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "500",
  },
  questionText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 30,
    textAlign: "center",
    lineHeight: 30,
  },
  optionsContainer: {
    marginTop: 10,
  },

  // No questions style
  noQuestionsText: {
    fontSize: 18,
    color: COLORS.text,
    textAlign: "center",
    padding: 20,
  },
  //time
  timeLockedContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 30,
    width: "90%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  timeLockedTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 15,
    textAlign: "center",
  },
  timeLockedText: {
    fontSize: 18,
    color: COLORS.textLight,
    marginBottom: 5,
    textAlign: "center",
    lineHeight: 24,
  },
  timeLockedSubtext: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 20,
    marginBottom: 25,
    textAlign: "center",
    lineHeight: 22,
  },
  timeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  timeText: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
    paddingHorizontal: 10,
  },
  timeSeparator: {
    fontSize: 18,
    color: COLORS.textLight,
  },
});
