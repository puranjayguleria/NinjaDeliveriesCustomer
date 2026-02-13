import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import SlotAvailabilityTester from '../utils/testSlotBasedAvailability';

export default function SlotAvailabilityTesterComponent() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    try {
      setLoading(true);
      addResult(`🧪 Starting ${testName}...`);
      
      const result = await testFunction();
      
      if (result) {
        addResult(`✅ ${testName} completed successfully`);
        console.log(`${testName} result:`, result);
      } else {
        addResult(`⚠️ ${testName} completed with no result`);
      }
    } catch (error) {
      addResult(`❌ ${testName} failed: ${error}`);
      console.error(`${testName} error:`, error);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Slot-Based Availability Tester</Text>
      <Text style={styles.subtitle}>Test the new worker availability system</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => runTest('Time Slot Parsing', () => Promise.resolve(SlotAvailabilityTester.testTimeSlotParsing()))}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Time Parsing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => runTest('Sample Data Creation', SlotAvailabilityTester.createSampleWorkerData)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Create Sample Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => runTest('Basic Availability', SlotAvailabilityTester.testBasicAvailability)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Basic Availability</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => runTest('Enhanced Availability', SlotAvailabilityTester.testEnhancedAvailability)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Enhanced Availability</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => runTest('Slot-based Filtering', SlotAvailabilityTester.testSlotBasedFiltering)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Company Filtering</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.successButton]}
          onPress={() => runTest('All Tests', SlotAvailabilityTester.runAllTests)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={clearResults}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
          {testResults.length === 0 ? (
            <Text style={styles.noResults}>No test results yet. Run a test to see results.</Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  successButton: {
    backgroundColor: '#059669',
  },
  secondaryButton: {
    backgroundColor: '#64748b',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  resultsScroll: {
    flex: 1,
  },
  noResults: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  resultText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});