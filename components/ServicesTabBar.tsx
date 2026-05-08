import React from 'react';
import { View } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useServiceCart } from '../context/ServiceCartContext';
import { useToggleContext } from '../context/ToggleContext';
import ServicesBottomTabs from './ServicesBottomTabs';

interface Props {
  activeTab?: 'home' | 'explore' | 'cart' | 'bookings';
}

export default function ServicesTabBar({ activeTab = 'explore' }: Props) {
  const navigation = useNavigation<any>();
  const { totalItems } = useServiceCart();
  const { activeMode } = useToggleContext();
  const isFocused = useIsFocused();

  // Only render when screen is focused AND we are in service mode.
  // This prevents the double tab bar when the native grocery tab bar
  // is visible (grocery mode) or when the screen is not on top.
  if (!isFocused || activeMode === 'grocery') return null;

  const goHome = () => {
    const state = navigation.getState?.();
    const stackIndex = state?.index ?? 0;

    if (stackIndex > 0) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'ServicesHome' }],
        })
      );
    } else {
      navigation.navigate('ServicesHome');
    }
  };

  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
      <ServicesBottomTabs
        activeTab={activeTab}
        cartItemCount={totalItems}
        onTabPress={(tab) => {
          if (tab === 'home') {
            goHome();
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
