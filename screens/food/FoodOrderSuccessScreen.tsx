import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const AUTO_NAVIGATE_SECONDS = 10;

export default function FoodOrderSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { grandTotal = 0, restaurantName = '', orderId = '', isScheduled = false } = route.params ?? {};

  const [countdown, setCountdown] = useState(AUTO_NAVIGATE_SECONDS);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isScheduled) return;

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: AUTO_NAVIGATE_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown timer
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Navigate after delay
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'FoodRestaurants' }],
      });
    }, AUTO_NAVIGATE_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [isScheduled]);

  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name="checkmark-circle" size={80} color="#16a34a" />
      </View>
      <Text style={s.title}>{isScheduled ? 'Order Scheduled!' : 'Order Placed!'}</Text>
      <Text style={s.sub}>
        Your order from {restaurantName} has been {isScheduled ? 'scheduled' : 'placed'} successfully.
      </Text>
      <Text style={s.amount}>₹{grandTotal}</Text>
      
      {isScheduled ? (
        <View style={s.scheduledBox}>
          <Ionicons name="time-outline" size={20} color="#FF6B35" />
          <Text style={s.scheduledText}>
            Your order will be prepared and delivered at your scheduled time
          </Text>
        </View>
      ) : (
        <Text style={s.note}>We'll notify you when your order is confirmed.</Text>
      )}

      {isScheduled && (
        <View style={s.countdownWrap}>
          <View style={s.progressBarBg}>
            <Animated.View
              style={[s.progressBarFill, {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }]}
            />
          </View>
          <Text style={s.countdownText}>Redirecting in {countdown}s...</Text>
        </View>
      )}

      {!!orderId && !isScheduled && (
        <TouchableOpacity
          style={s.trackBtn}
          onPress={() => navigation.replace('FoodTracking', { orderId })}
          activeOpacity={0.9}
        >
          <Ionicons name="bicycle-outline" size={18} color="#fff" />
          <Text style={s.trackBtnText}>Track Order</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={s.btn}
        onPress={() => navigation.navigate('FoodRestaurants')}
        activeOpacity={0.9}
      >
        <Text style={s.btnText}>Back to Restaurants</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  iconWrap: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  amount: { fontSize: 28, fontWeight: '800', color: '#FF6B35', marginTop: 20 },
  note: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
  scheduledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff5f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  scheduledText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
  countdownWrap: {
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  countdownText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  trackBtn: {
    marginTop: 28, backgroundColor: '#FF6B35',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14,
  },
  trackBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btn: {
    marginTop: 12,
    paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FF6B35',
  },
  btnText: { color: '#FF6B35', fontWeight: '700', fontSize: 15 },
});
