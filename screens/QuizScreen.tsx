// screens/QuizScreen.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
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
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { useLocationContext } from '@/context/LocationContext';

const { width } = Dimensions.get('window');
const TIMER_DURATION = 15;

function isToday(ts: Timestamp) {
  const d = ts.toDate(), n = new Date();
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
  const [loading, setLoading]                   = useState(true);
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [displayName, setDisplayName]           = useState('');
  const [savingName, setSavingName]             = useState(false);

  // Quiz state
  const [questions, setQuestions] = useState<any[]>([]);
  const [current, setCurrent]     = useState(0);
  const [score, setScore]         = useState(0);

  // Timer state
  const [timeLeft, setTimeLeft]   = useState(TIMER_DURATION);
  const timerAnim = useRef(new Animated.Value(1)).current;

  // Guard to only finish once
  const finishedRef = useRef(false);

  // On mount: load profile, check play-today, fetch questions
  useEffect(() => {
    (async () => {
      try {
        // 1) Load profile
        const ud = await getDoc(doc(db, 'users', user.uid));
        const data = ud.data() || {};
        if (!data.name) {
          setNameModalVisible(true);
        } else {
          setDisplayName(data.name);
        }

        // 2) Check if already played today
        const playedQ = query(
          collection(db, 'leaderboard'),
          where('storeId', '==', storeId),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const playedSnap = await getDocs(playedQ);
        if (!playedSnap.empty && isToday(playedSnap.docs[0].data().timestamp)) {
          setLockModalVisible(true);
          return;
        }

        // 3) Fetch quiz definition
        const qzSnap = await getDocs(
          query(collection(db, 'quizzes'),
                where('storeId', '==', storeId),
                limit(1))
        );
        if (qzSnap.empty) throw new Error('No quiz configured');
        const quizRef = qzSnap.docs[0].ref;

        // 4) Fetch questions
        let qsSnap = await getDocs(
          query(collection(db, 'questions'),
                where('quizId', '==', quizRef),
                orderBy('text'))
        );
        if (qsSnap.empty) {
          qsSnap = await getDocs(
            query(collection(db, 'questions'),
                  where('storeId', '==', storeId),
                  orderBy('text'))
          );
        }
        setQuestions(qsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not load quiz.');
      } finally {
        setLoading(false);
      }
    })();
  }, [db, storeId, user.uid]);

  // Save display name
  const saveName = async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    setSavingName(true);
    await setDoc(doc(db, 'users', user.uid), { name }, { merge: true });
    setSavingName(false);
    setNameModalVisible(false);
  };

  // Write final leaderboard entry exactly once
  const finishQuiz = useCallback(
    async (finalScore: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      await addDoc(collection(db, 'leaderboard'), {
        score:     finalScore,
        storeId,
        timestamp: serverTimestamp(),
        userId:    user.uid,
        userName:  displayName,
      });
      nav.replace('Congrats', {
        correctCount:   finalScore,
        totalQuestions: questions.length,
      });
    },
    [db, displayName, nav, questions.length, storeId, user.uid]
  );

  // Handle an answer tap
  const onAnswer = useCallback(
    (optId: number) => {
      if (finishedRef.current) return;
      const q = questions[current];
      const gotIt = optId === q.correctOptionId;
      setScore(s => s + (gotIt ? 1 : 0));

      if (current + 1 < questions.length) {
        setCurrent(c => c + 1);
      } else {
        finishQuiz(score + (gotIt ? 1 : 0));
      }
    },
    [current, finishQuiz, questions, score]
  );

  // Per-question timer
  useEffect(() => {
    if (finishedRef.current || !questions.length) return;

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
          onAnswer(-1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [current, onAnswer, questions.length, timerAnim]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#009688"/>
      </View>
    );
  }

  // If user already played today, show the “already played” screen
  if (lockModalVisible) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockedText}>You’ve already played today!</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => nav.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.leaderboardButton}
          onPress={() => nav.navigate('Leaderboard')}
        >
          <Text style={styles.leaderboardButtonText}>View Leaderboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Name prompt */}
      <Modal visible={nameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Welcome!</Text>
            <Text style={styles.modalText}>
              Please enter your name for the leaderboard.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
            />
            <TouchableOpacity
              style={styles.modalButton}
              onPress={saveName}
              disabled={savingName}
            >
              <Text style={styles.modalButtonText}>
                {savingName ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Timer */}
      {questions.length > 0 && (
        <View style={styles.timerRow}>
          <Text style={styles.timerCount}>{timeLeft}s</Text>
          <View style={styles.timerBarBg}>
            <Animated.View
              style={[
                styles.timerBar,
                {
                  width: timerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Question + options */}
      {questions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.questionText}>{questions[current].text}</Text>
          {questions[current].options.map((opt: any) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.option}
              activeOpacity={0.7}
              onPress={() => onAnswer(opt.id)}
            >
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.center}>
          <Text>No questions available.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex:1, padding:16, backgroundColor:'#f9f9f9' },
  center:             { flex:1, justifyContent:'center', alignItems:'center' },
  lockedText:         { fontSize:18, marginBottom:20, textAlign:'center' },
  backButton:         { backgroundColor:'#ccc', padding:12, borderRadius:6, marginBottom:12 },
  backButtonText:     { fontSize:16 },
  leaderboardButton:  { backgroundColor:'#007AFF', padding:12, borderRadius:6 },
  leaderboardButtonText:{ color:'#fff', fontSize:16 },

  // Name modal
  modalOverlay:    {
    flex:1, backgroundColor:'rgba(0,0,0,0.5)',
    justifyContent:'center', alignItems:'center'
  },
  modalCard:       { width:'80%', backgroundColor:'#fff', padding:20, borderRadius:10 },
  modalTitle:      { fontSize:20, fontWeight:'700', marginBottom:10 },
  modalText:       { fontSize:16, marginBottom:12, textAlign:'center' },
  modalInput:      { borderWidth:1, borderColor:'#ccc', borderRadius:6, padding:10, marginBottom:12 },
  modalButton:     { backgroundColor:'#007AFF', padding:12, borderRadius:6, alignItems:'center' },
  modalButtonText: { color:'#fff', fontWeight:'600' },

  // Timer
  timerRow:        { flexDirection:'row', alignItems:'center', marginBottom:12 },
  timerCount:      { fontSize:16, fontWeight:'600', marginRight:8 },
  timerBarBg:      { flex:1, height:4, backgroundColor:'#eee', borderRadius:2, overflow:'hidden' },
  timerBar:        { height:4, backgroundColor:'#2e7d32' },

  // Question card
  card:            { flex:1, backgroundColor:'#fff', borderRadius:10, padding:20, justifyContent:'center' },
  questionText:    { fontSize:18, fontWeight:'700', marginBottom:20, textAlign:'center' },
  option:          { backgroundColor:'#f0f0f0', padding:14, borderRadius:8, marginVertical:6 },
  optionLabel:     { fontSize:16, textAlign:'center' },
});
