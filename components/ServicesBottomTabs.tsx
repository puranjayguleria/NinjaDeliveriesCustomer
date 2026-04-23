import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ServicesBottomTabsProps {
  activeTab: 'home' | 'explore' | 'cart' | 'bookings';
  onTabPress: (tab: 'home' | 'explore' | 'cart' | 'bookings') => void;
  cartItemCount?: number;
}

export default function ServicesBottomTabs({
  activeTab,
  onTabPress,
  cartItemCount = 0,
}: ServicesBottomTabsProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: 'home-outline' as const },
    { id: 'explore', label: 'Explore', icon: 'search-outline' as const },
    { id: 'bookings', label: 'Bookings', icon: 'calendar-outline' as const },
    { id: 'cart', label: 'Cart', icon: 'cart-outline' as const },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => onTabPress(tab.id as 'home' | 'explore' | 'cart' | 'bookings')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons
              name={tab.icon}
              size={24}
              color={activeTab === tab.id ? '#00b4a0' : '#64748b'}
            />
            {tab.id === 'cart' && cartItemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartItemCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.label, activeTab === tab.id && styles.activeLabel]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 4,
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  activeTab: {
    backgroundColor: '#f0fdfb',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#00b4a0',
    fontWeight: '700',
  },
});
