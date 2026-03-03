import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import Video from "react-native-video";
import { useIsFocused, useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const H = 16;
const MOSAIC_W_GAME = width * 0.5;

interface QuizBannerProps {
  storeId: string;
}

const QuizBanner: React.FC<QuizBannerProps> = ({ storeId }) => {
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dur, setDur] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const nav = useNavigation();
  const isFocused = useIsFocused();
  const ref = useRef<Video>(null);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("quizzes")
      .where("storeId", "==", storeId)
      .limit(1)
      .onSnapshot(
        (querySnapshot) => {
          try {
            if (querySnapshot.empty) {
              setError("No active quiz found");
              setQuiz(null);
            } else {
              const doc = querySnapshot.docs[0];
              const quizData = doc.data();
              setQuiz({ id: doc.id, ...quizData });
              setError(null);
            }
          } catch (e) {
            setError("Error loading quiz");
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error("Firestore error:", err);
          setError("Failed to load quiz");
          setLoading(false);
        }
      );

    return () => {
      unsubscribe();
    };
  }, [storeId]);

  const onProgress = ({ currentTime }: { currentTime: number }) => {
    if (dur && currentTime >= dur - 0.05) {
      ref.current?.seek(0);
    }
  };

  if (loading) {
    return (
      <View style={[styles.mediaBox, styles.center]}>
        <ActivityIndicator color="#ffffff" size="large" />
      </View>
    );
  }

  if (error || !quiz) {
    return (
      <View style={[styles.mediaBox, styles.center]}>
        <Text style={styles.errorTxt}>{error || "No quiz available"}</Text>
      </View>
    );
  }

  const isMp4 =
    quiz.introGifUrl?.endsWith(".mp4") ||
    quiz.introGifUrl?.includes(".mp4?") ||
    quiz.introGifUrl?.match(/\.mp4(\?|$)/i);

  if (!quiz.introGifUrl) {
    return (
      <View style={[styles.mediaBox, styles.center]}>
        <Text style={styles.errorTxt}>Quiz image missing</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.quizCard}
      onPress={() => nav.navigate("Quiz", { quizId: quiz.id })}
    >
      {isMp4 ? (
        <>
          <Video
            ref={ref}
            source={{ uri: quiz.introGifUrl }}
            style={styles.mediaBox}
            resizeMode="cover"
            muted
            repeat
            paused={!isFocused}
            playInBackground={false}
            playWhenInactive={false}
            bufferConfig={{
              minBufferMs: 1500,
              maxBufferMs: 6000,
              bufferForPlaybackMs: 750,
              bufferForPlaybackAfterRebufferMs: 1500,
            }}
            maxBitRate={1500000}
            onLoad={({ duration }) => {
              setDur(duration);
              setIsReady(true);
            }}
            onProgress={onProgress}
            onReadyForDisplay={() => setIsReady(true)}
            onError={() => setIsReady(true)}
          />
          {!isReady && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator color="#ffffff" size="large" />
            </View>
          )}
        </>
      ) : (
        <>
          <Image
            source={{ uri: quiz.introGifUrl }}
            style={styles.mediaBox}
            resizeMode="cover"
            onLoad={() => setIsReady(true)}
            onError={() => setIsReady(true)}
          />
          {!isReady && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator color="#ffffff" size="large" />
            </View>
          )}
        </>
      )}
      <View style={styles.quizOverlay}>
        <Text style={styles.quizTxt}>
          {quiz.title || "Play Quiz & Earn Discounts"}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  quizCard: {
    margin: H,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 2,
  },
  mediaBox: {
    width: "100%",
    height: MOSAIC_W_GAME,
    backgroundColor: "transparent",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  quizOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
  },
  quizTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  errorTxt: {
    color: "#c62828",
    textAlign: "center",
    margin: 12,
  },
});

export default React.memo(QuizBanner);
