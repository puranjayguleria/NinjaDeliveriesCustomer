/**
 * One-time setup screen to create foodOrderSettings collection
 * Run this once, then you can delete this file
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

const DEFAULT_FOOD_SETTINGS = {
  additionalCostPerKm: 8,
  badWeather: false,
  baseDeliveryCharge: 5,
  distanceThreshold: 0,
  gstPercentage: 5,
  platformFee: 1,
  surgeFee: 10,
  weatherFromApi: false,
  freeDeliveryAbove: 199,
  packagingFee: 20,
  itemGstDefaultPercent: 5,
  highGstPercent: 18,
  nightSurgeEnabled: true,
  nightSurgePercent: 10,
  nightSurgeFromHour: 22,
  nightSurgeToHour: 6,
};

export default function SetupFoodSettings({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const createFoodOrderSettings = async () => {
    setLoading(true);
    setLogs([]);
    setSummary(null);

    try {
      addLog('🚀 Starting foodOrderSettings collection creation...\n');

      // Fetch all restaurants
      addLog('📋 Fetching all restaurants...');
      const restaurantsSnapshot = await firestore().collection('restaurants').get();
      
      if (restaurantsSnapshot.empty) {
        addLog('⚠️  No restaurants found in the database.');
        Alert.alert('No Restaurants', 'No restaurants found in the database.');
        setLoading(false);
        return;
      }

      addLog(`✅ Found ${restaurantsSnapshot.size} restaurants\n`);

      // Check existing settings
      const existingSettings = await firestore().collection('foodOrderSettings').get();
      const existingRestaurantIds = new Set<string>();
      existingSettings.forEach(doc => {
        const data = doc.data();
        if (data.restaurantId) {
          existingRestaurantIds.add(data.restaurantId);
        }
      });

      addLog(`📊 Existing foodOrderSettings documents: ${existingSettings.size}\n`);

      let created = 0;
      let skipped = 0;
      let errors = 0;

      // Create settings for each restaurant
      for (const restaurantDoc of restaurantsSnapshot.docs) {
        const restaurantId = restaurantDoc.id;
        const restaurantData = restaurantDoc.data();
        const restaurantName = restaurantData.name || 'Unknown Restaurant';

        if (existingRestaurantIds.has(restaurantId)) {
          addLog(`⏭️  Skipped: ${restaurantName}`);
          skipped++;
          continue;
        }

        try {
          const foodSettingData = {
            ...DEFAULT_FOOD_SETTINGS,
            restaurantId: restaurantId,
            restaurantName: restaurantName,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };

          await firestore().collection('foodOrderSettings').add(foodSettingData);
          addLog(`✅ Created: ${restaurantName}`);
          created++;
        } catch (error: any) {
          addLog(`❌ Error: ${restaurantName} - ${error.message}`);
          errors++;
        }
      }

      // Summary
      addLog('\n' + '='.repeat(40));
      addLog('📊 SUMMARY');
      addLog('='.repeat(40));
      addLog(`✅ Created: ${created}`);
      addLog(`⏭️  Skipped: ${skipped}`);
      addLog(`❌ Errors: ${errors}`);
      addLog(`📋 Total: ${restaurantsSnapshot.size}`);
      addLog('='.repeat(40));

      setSummary({ created, skipped, errors, total: restaurantsSnapshot.size });

      Alert.alert(
        'Setup Complete! ✨',
        `Created: ${created}\nSkipped: ${skipped}\nErrors: ${errors}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1D2E" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Setup Food Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.content}>
        <View style={s.infoCard}>
          <Ionicons name="information-circle" size={32} color="#FF6B35" />
          <Text style={s.infoTitle}>One-Time Setup</Text>
          <Text style={s.infoText}>
            This will create foodOrderSettings collection for all restaurants in your database.
          </Text>
          <Text style={s.infoSubtext}>
            • Safe to run multiple times{'\n'}
            • Skips existing settings{'\n'}
            • Creates default settings for new restaurants
          </Text>
        </View>

        {summary && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>📊 Results</Text>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>✅ Created:</Text>
              <Text style={s.summaryValue}>{summary.created}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>⏭️  Skipped:</Text>
              <Text style={s.summaryValue}>{summary.skipped}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>❌ Errors:</Text>
              <Text style={s.summaryValue}>{summary.errors}</Text>
            </View>
            <View style={[s.summaryRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 8 }]}>
              <Text style={[s.summaryLabel, { fontWeight: '700' }]}>📋 Total:</Text>
              <Text style={[s.summaryValue, { fontWeight: '700' }]}>{summary.total}</Text>
            </View>
          </View>
        )}

        <ScrollView style={s.logsContainer} contentContainerStyle={s.logsContent}>
          {logs.map((log, index) => (
            <Text key={index} style={s.logText}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.runBtn, loading && s.runBtnDisabled]}
          onPress={createFoodOrderSettings}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={s.runBtnText}>Running...</Text>
            </>
          ) : (
            <>
              <Ionicons name="play-circle" size={20} color="#FFFFFF" />
              <Text style={s.runBtnText}>Run Setup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1D2E',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1D2E',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  infoSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'left',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1D2E',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1D2E',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
  },
  logsContent: {
    paddingBottom: 20,
  },
  logText: {
    fontSize: 12,
    color: '#D1D5DB',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  runBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  runBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  runBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
