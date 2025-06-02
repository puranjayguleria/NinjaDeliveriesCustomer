// screens/LeaderboardScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocationContext } from '@/context/LocationContext';

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

export default function LeaderboardScreen() {
  const { location } = useLocationContext();
  const storeId = location.storeId;

  const [entries, setEntries]   = useState<Entry[]>([]);
  const [rewards, setRewards]   = useState<Record<number,string>>({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!storeId) return;
    // 1) Fetch today's leaderboard entries
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);

    firestore()
      .collection('leaderboard')
      .where('storeId', '==', storeId)
      .where('timestamp', '>=', start)
      .where('timestamp', '<=', end)
      .get()
      .then(snap => {
        const bestByUser = new Map<string,Entry>();
        snap.docs.forEach(d => {
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
        arr.sort((a,b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.timestamp.getTime() - b.timestamp.getTime();
        });
        setEntries(arr.slice(0,20));
      })
      .catch(err => console.error('Leaderboard load error', err))
      .finally(() => setLoading(false));

    // 2) Fetch rewards mapping
    firestore()
      .collection('rewards')
      .get()
      .then(snap => {
        const map: Record<number,string> = {};
        snap.docs.forEach(d => {
          const { position, description } = d.data() as Reward;
          map[position] = description;
        });
        setRewards(map);
      })
      .catch(err => console.warn('Rewards load error', err));
  }, [storeId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#89f7fe','#66a6ff']} style={styles.container}>
      <Text style={styles.header}>🏆 Today's Leaderboard</Text>

      {/* Top-3 prizes */}
      <View style={styles.rewardsContainer}>
        { [1,2,3].map(pos => (
          rewards[pos] ? (
            <Text key={pos} style={styles.rewardText}>
              {pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'}{' '}
              {pos}  
              {pos===1?'st':pos===2?'nd':'rd'} Prize: {rewards[pos]}
            </Text>
          ) : null
        )) }
      </View>

      {/* Entries */}
      {entries.length === 0 ? (
        <Text style={styles.empty}>No entries for today yet.</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.userId}
          renderItem={({ item, index }) => (
            <View style={[styles.row, index % 2 === 0 && styles.altRow]}>
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.name}>
                {item.userName || item.userId.slice(0,6)}
              </Text>
              <Text style={styles.score}>{item.score}</Text>
              <Text style={styles.time}>
                {item.timestamp.toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit'
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
  container:      { flex:1, paddingTop:60, paddingHorizontal:20 },
  center:         { flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#66a6ff' },
  header:         { fontSize:28,fontWeight:'700',color:'#fff',textAlign:'center',marginBottom:16 },

  rewardsContainer:{ marginBottom:20 },
  rewardText:     { fontSize:16, color:'#fff', textAlign:'center', marginVertical:4 },

  empty:          { fontSize:18,color:'#fff',marginTop:50,textAlign:'center' },
  row:            { flexDirection:'row',paddingVertical:12,alignItems:'center' },
  altRow:         { backgroundColor:'rgba(255,255,255,0.1)' },
  rank:           { width:30,fontSize:18,color:'#fff',fontWeight:'600' },
  name:           { flex:1,fontSize:18,color:'#fff' },
  score:          { width:50,fontSize:18,color:'#fff',textAlign:'center' },
  time:           { width:80,fontSize:16,color:'#fff',textAlign:'right' },
});
