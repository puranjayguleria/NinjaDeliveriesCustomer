import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useServiceCart } from '../context/ServiceCartContext';
import ServicesBottomTabs from './ServicesBottomTabs';

interface Props {
  activeTab?: 'home' | 'explore' | 'cart' | 'bookings';
}

export default function ServicesTabBar({ activeTab = 'explore' }: Props) {
  const navigation = useNavigation<any>();
  const { totalItems } = useServiceCart();

  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
      <ServicesBottomTabs
        activeTab={activeTab}
        cartItemCount={totalItems}
        onTabPress={(tab) => {
          if (tab === 'home') {
            // Use popToTop() to cleanly go back to ServicesHome without
            // triggering a navigation "switch" error when ServicesHome is
            // already in the stack below the current screen.
            // If popToTop fails (e.g. already at root), fall back to navigate.
            try {
              navigation.popToTop();
            } catch {
              navigation.navigate('ServicesHome');
            }
          } else if (tab === 'explore') {
            navigation.navigate('AllServices');
          } else if (tab === 'cart') {
            navigation.navigate('ServiceCart');
          } else if (tab === 'bookings') {
            navigation.navigate('BookingHistory');
          }
        }}
      />
    </View>
  );
}
