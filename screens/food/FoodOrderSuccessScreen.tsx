import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function FoodOrderSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { grandTotal = 0, restaurantName = '', orderId = '', isScheduled = false, scheduledFor } = route.params ?? {};

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
