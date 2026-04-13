import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Modal, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const AUTO_SECONDS = 4;

export default function FoodOrderSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { grandTotal = 0, restaurantName = '', orderId = '', isScheduled = false } = route.params ?? {};

  const [visible, setVisible] = useState(true);
  const [countdown, setCountdown] = useState(AUTO_SECONDS);

  // Animations
  const scaleAnim  = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const lineAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pop-in animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Progress line animation
    Animated.timing(lineAnim, {
      toValue: 1,
      duration: AUTO_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);

    // Auto navigate
    const timer = setTimeout(() => navigateAway(), AUTO_SECONDS * 1000);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, []);

  const navigateAway = () => {
    setVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'FoodRestaurants' }] });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>

          {/* Icon */}
          <View style={s.iconCircle}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>

          {/* Title */}
          <Text style={s.title}>{isScheduled ? 'Order Scheduled!' : 'Order Placed!'}</Text>
          <Text style={s.sub}>
            Your order from{'\n'}
            <Text style={s.restaurant}>{restaurantName}</Text>
            {'\n'}has been {isScheduled ? 'scheduled' : 'placed'} successfully.
          </Text>

          {/* Amount */}
          <View style={s.amountRow}>
            <Text style={s.amountLabel}>Total Paid</Text>
            <Text style={s.amount}>₹{grandTotal}</Text>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Progress line */}
          <View style={s.progressBg}>
            <Animated.View style={[s.progressFill, {
              width: lineAnim.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] }),
            }]} />
          </View>
          <Text style={s.countdownText}>Going to home in {countdown}s...</Text>

          {/* Buttons */}
          {!!orderId && !isScheduled && (
            <TouchableOpacity
              style={s.trackBtn}
              onPress={() => {
                setVisible(false);
                navigation.reset({
                  index: 0,
                  routes: [
                    { name: 'FoodRestaurants' },
                    { name: 'FoodTracking', params: { orderId } },
                  ],
                });
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="bicycle-outline" size={18} color="#fff" />
              <Text style={s.trackBtnText}>Track Order</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.homeBtn} onPress={navigateAway} activeOpacity={0.8}>
            <Text style={s.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: width - 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#16a34a',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  sub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  restaurant: {
    fontWeight: '700',
    color: '#FF6B35',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    backgroundColor: '#fff5f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  amountLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF6B35',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 18,
  },
  progressBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  countdownText: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 20,
  },
  trackBtn: {
    width: '100%',
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  trackBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  homeBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#FF6B35',
    fontWeight: '700',
    fontSize: 15,
  },
});
