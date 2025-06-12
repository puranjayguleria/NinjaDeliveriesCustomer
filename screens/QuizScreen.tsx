// screens/QuizScreen.tsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Animated,
  Easing,
  BackHandler,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getAuth } from "@react-native-firebase/auth";
import { useLocationContext } from "@/context/LocationContext";
import LinearGradient from "react-native-linear-gradient";
import { format, isBefore, isAfter, parse } from "date-fns";
import Loader from "@/components/VideoLoader";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const COLORS = {
  primary: "#00b4a0",
  secondary: "#00d2c7",
  accent: "#ff6f91",
  background: "#ffffff",
  card: "#f6fffe",
  text: "#003b36",
  textLight: "#6c8a87",
  success: "#28c76f",
  warning: "#ff9f43",
  error: "#ea5455",
  timer: "#ff6b6b",
  buttonText: "#ffffff",
};

const TIMER_DURATION = 15;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function isToday(ts: Timestamp) {
  const d = ts.toDate();
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAIN SCREEN                                 */
/* -------------------------------------------------------------------------- */

export default function QuizScreen() {
  const nav = useNavigation();
  const { location } = useLocationContext();
  const storeId = location.storeId!;
  const db = getFirestore(getApp());
  const auth = getAuth(getApp());
  const user = auth.currentUser!;

  /* ---------------------------------------------------------------------- */
  /*                               UI STATE                                 */
  /* ---------------------------------------------------------------------- */

  const [loading, setLoading] = useState(true); // full-screen loader (initial)
  const [submitting, setSubmitting] = useState(false); // show scooter while writing
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  /* ---------------------------------------------------------------------- */
  /*                               QUIZ STATE                               */
  /* ---------------------------------------------------------------------- */

  const [questions, setQuestions] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);

  /* ---------------------------------------------------------------------- */
  /*                              TIMER STATE                               */
  /* ---------------------------------------------------------------------- */

  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* ---------------------------------------------------------------------- */
  /*                           RUNTIME GUARDS                               */
  /* ---------------------------------------------------------------------- */

  const finishedRef = useRef(false);
  const optionScale = useRef(new Animated.Value(1)).current;
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  /* quiz availability window ------------------------------------------------*/

  const [isQuizTime, setIsQuizTime] = useState(false);
  const [startTimeStr, setStartTimeStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");

  /* ---------------------------------------------------------------------- */
  /*                          INITIAL DATA LOAD                             */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const checkWindow = async () => {
      const now = new Date();
      try {
        const qs = await getDocs(collection(db, "quizzes"));
        if (qs.empty) return;
        const cfg = qs.docs[0].data();
        if (typeof cfg.from !== "string" || typeof cfg.to !== "string") return;
        const start = parse(cfg.from, "HH:mm", now);
        const end = parse(cfg.to, "HH:mm", now);
        if (isNaN(start) || isNaN(end)) return;
        setStartTimeStr(format(start, "h:mm a"));
        setEndTimeStr(format(end, "h:mm a"));
        setIsQuizTime(isAfter(now, start) && isBefore(now, end));
      } catch (e) {
        console.warn("quiz window", e);
      }
    };
    checkWindow();
  }, [db]);

  useEffect(() => {
    (async () => {
      try {
        /* 1 – Profile ----------------------------------------------------- */
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const profile = profileSnap.data() || {};
        if (!profile.name) {
          setNameModalVisible(true);
        } else {
          setDisplayName(profile.name);
          setQuizStarted(true);
        }

        /* 2 – Played today? ---------------------------------------------- */
        const playedQ = query(
          collection(db, "leaderboard"),
          where("storeId", "==", storeId),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(1),
        );
        const playedSnap = await getDocs(playedQ);
        if (
          !playedSnap.empty &&
          isToday(playedSnap.docs[0].data().timestamp)
        ) {
          setLockModalVisible(true);
          return;
        }

        /* 3 – Quiz definition + Questions ------------------------------- */
        const quizSnap = await getDocs(
          query(collection(db, "quizzes"), where("storeId", "==", storeId), limit(1)),
        );
        if (quizSnap.empty) throw new Error("No quiz configured");
        const quizRef = quizSnap.docs[0].ref;

        let qsSnap = await getDocs(
          query(collection(db, "questions"), where("quizId", "==", quizRef), orderBy("text")),
        );
        // fallback legacy
        if (qsSnap.empty) {
          qsSnap = await getDocs(
            query(collection(db, "questions"), where("storeId", "==", storeId), orderBy("text")),
          );
        }
        setQuestions(qsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Could not load quiz.");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, storeId, user.uid]);

  /* ---------------------------------------------------------------------- */
  /*                             SAVE NAME FLOW                             */
  /* ---------------------------------------------------------------------- */
  const saveName = async () => {
    const n = displayName.trim();
    if (!n) {
      Alert.alert("Name required", "Please enter your name");
      return;
    }
    try {
      setSavingName(true);
      await setDoc(doc(db, "users", user.uid), { name: n }, { merge: true });
      setSavingName(false);
      setNameModalVisible(false);
      setQuizStarted(true);
    } catch (e) {
      console.error(e);
      setSavingName(false);
      Alert.alert("Error", "Could not save name. Try again.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                           FINISH QUIZ ONCE                             */
  /* ---------------------------------------------------------------------- */

  const finishQuiz = useCallback(
    async (finalScore: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setSubmitting(true);
      try {
        await addDoc(collection(db, "leaderboard"), {
          score: finalScore,
          correctCount: finalScore,
          totalQuestions: questions.length,
          storeId,
          timestamp: serverTimestamp(),
          userId: user.uid,
          userName: displayName,
          scorePercentage: Math.round((finalScore / questions.length) * 100),
        });
      } catch (e) {
        console.error("leaderboard write", e);
      }
      nav.replace("Congrats", {
        correctCount: finalScore,
        totalQuestions: questions.length,
      });
    },
    [db, displayName, nav, questions.length, storeId, user.uid],
  );

  /* ---------------------------------------------------------------------- */
  /*                         ANSWER HANDLING + FX                           */
  /* ---------------------------------------------------------------------- */

  const onAnswer = useCallback(
    (optId: number) => {
      if (finishedRef.current) return;
      setSelectedOption(optId);

      Animated.sequence([
        Animated.timing(optionScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.timing(optionScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start(() => {
        const q = questions[current];
        const gotIt = optId === q.correctOptionId;
        setScore(s => s + (gotIt ? 1 : 0));

        setTimeout(() => {
          setSelectedOption(null);
          if (current + 1 < questions.length) {
            setCurrent(c => c + 1);
          } else {
            finishQuiz(score + (gotIt ? 1 : 0));
          }
        }, 1000);
      });
    },
    [current, finishQuiz, questions, score],
  );

  /* ---------------------------------------------------------------------- */
  /*                              PER Q TIMER                               */
  /* ---------------------------------------------------------------------- */

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
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(iv);
          onAnswer(-1); // time-out
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [isQuizTime, current, questions.length, onAnswer, timerAnim]);

  /* ---------------------------------------------------------------------- */
  /*                       HARDWARE BACK HANDLER GUARD                      */
  /* ---------------------------------------------------------------------- */

  useFocusEffect(
    useCallback(() => {
      if (!isQuizTime || loading || lockModalVisible || questions.length === 0)
        return;

      const onBack = () => {
        Alert.alert(
          "Exit Quiz?",
          "If you exit now, you won’t be able to attempt again today.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Exit",
              style: "destructive",
              onPress: () => nav.goBack(),
            },
          ],
        );
        return true;
      };
      BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => BackHandler.removeEventListener("hardwareBackPress", onBack);
    }, [isQuizTime, loading, lockModalVisible, questions.length, nav]),
  );

  /* ---------------------------------------------------------------------- */
  /*                        EARLY RETURN SCREENS                            */
  /* ---------------------------------------------------------------------- */

  if (loading)
    return (
      <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.center}>
        <Loader />
      </LinearGradient>
    );

  if (!isQuizTime)
    return (
      <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.center}>
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

  if (lockModalVisible)
    return (
      <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.center}>
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedTitle}>Daily Challenge Complete!</Text>
          <Text style={styles.lockedText}>
            You’ve already played today. Come back tomorrow for another chance!
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

  /* ---------------------------------------------------------------------- */
  /*                                RENDER                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <LinearGradient colors={[COLORS.background, "#E2E8F0"]} style={styles.flex}>
      {/* SafeArea keeps timer clear of notches */}
      <SafeAreaView style={styles.flex}>
        {/* TIMER ROW ----------------------------------------------------- */}
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
                    backgroundColor: timeLeft <= 5 ? COLORS.timer : COLORS.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* MAIN CARD ----------------------------------------------------- */}
        {questions.length > 0 ? (
          <Animated.View style={styles.card}>
            <Text style={styles.questionNumber}>
              Question {current + 1} of {questions.length}
            </Text>
            <Text style={styles.questionText}>{questions[current].text}</Text>

            <View style={styles.optionsContainer}>
              {questions[current].options.map((opt: any) => {
                const isSelected = selectedOption === opt.id;
                const isCorrect = opt.id === questions[current].correctOptionId;
                const showCorrect = selectedOption !== null && isCorrect;
                const showIncorrect = isSelected && !isCorrect;

                return (
                  <View key={opt.id} style={styles.optionWrapper}>
                    <Animated.View style={{ transform: [{ scale: optionScale }] }}>
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
                          <Text style={styles.optionLabel}>{opt.label}</Text>
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
            <Text style={styles.noQuestionsText}>No questions available.</Text>
          </View>
        )}

        {/* NAME MODAL ---------------------------------------------------- */}
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

        {/* SCOOTER LOADER OVERLAY --------------------------------------- */}
        {submitting && (
          <View style={styles.submitOverlay}>
            <Loader />
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },

  /* loading / center */
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* card & question */
  card: {
    flex: 1,
    margin: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    justifyContent: "center",
  },
  questionNumber: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 8,
  },
  questionText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 30,
  },
  optionsContainer: { marginTop: 10 },
  optionWrapper: { marginVertical: 8 },
  option: {
    backgroundColor: "#e6f7f5",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccf0ec",
    minHeight: 80,
    justifyContent: "center",
  },
  optionContent: { alignItems: "center" },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 4,
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
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },

  /* timer */
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  timerCount: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 12,
    minWidth: 40,
    textAlign: "center",
  },
  timerBarBg: { flex: 1, height: 6, backgroundColor: "#E2E8F0", borderRadius: 3 },
  timerBar: { height: "100%", borderRadius: 3 },

  /* locked / unavailable */
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

  /* time-window locked */
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
  },
  timeDisplay: { flexDirection: "row", alignItems: "center", marginVertical: 15 },
  timeText: { fontSize: 28, fontWeight: "700", color: COLORS.primary, paddingHorizontal: 10 },
  timeSeparator: { fontSize: 18, color: COLORS.textLight },
  timeLockedSubtext: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 20,
    marginBottom: 25,
    textAlign: "center",
  },

  /* shared button */
  button: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonText: { color: COLORS.buttonText, fontSize: 16, fontWeight: "600" },

  /* name modal */
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

  /* overlay while submitting */
  submitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* misc */
  noQuestionsText: { fontSize: 18, color: COLORS.text, textAlign: "center", padding: 20 },
});
