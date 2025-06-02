// screens/CongratsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CongratsScreen() {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { correctCount, totalQuestions } = params;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = auth().currentUser?.uid ?? 'guest';
    firestore()
      .collection('leaderboard')
      .add({
        userId,
        correctCount,
        totalQuestions,
        timestamp: firestore.FieldValue.serverTimestamp(),
      })
      .finally(() => setLoading(false));
  }, [correctCount, totalQuestions]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#a18cd1','#fbc2eb']} style={styles.container}>
      <Text style={styles.title}>🎉 Well Done!</Text>
      <Text style={styles.score}>
        You answered {correctCount} / {totalQuestions}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => nav.navigate('Leaderboard')}
      >
        <Text style={styles.buttonText}>View Leaderboard</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.homeBtn]}
        onPress={() => nav.navigate('ProductsHome')}
      >
        <Text style={[styles.buttonText, { color: '#fff' }]}>Back to Shop</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center:   { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#a18cd1' },
  container:{ flex:1, justifyContent:'center', alignItems:'center', padding:20 },
  title:    { fontSize:32, fontWeight:'700', color:'#fff', marginBottom:10 },
  score:    { fontSize:20, color:'#fff', marginBottom:30 },
  button:   {
    backgroundColor:'#fff',
    paddingVertical:12,
    paddingHorizontal:24,
    borderRadius:24,
    marginVertical:8,
  },
  homeBtn:  { backgroundColor:'#009688' },
  buttonText:{ fontSize:16, fontWeight:'600', color:'#333' },
});
