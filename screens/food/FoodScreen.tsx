import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function FoodScreen() {
  const navigation = useNavigation<any>();

  const handleGoHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "HomeTab" }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Food</Text>
      <Text style={styles.subtitle}>Coming Soon...</Text>

      <TouchableOpacity 
        style={styles.homeButton} 
        onPress={handleGoHome}
        activeOpacity={0.8}
      >
        <Ionicons name="home" size={20} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={styles.homeButtonText}>Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00b4a0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
