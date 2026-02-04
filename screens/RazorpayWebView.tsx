import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface RazorpayWebViewProps {
  route: {
    params: {
      orderId: string;
      amount: number;
      keyId: string;
      currency: string;
      name: string;
      description: string;
      prefill: {
        contact: string;
        email: string;
        name: string;
      };
      onSuccess: (response: any) => void;
      onFailure: (error: any) => void;
    };
  };
}

export default function RazorpayWebView() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const {
    orderId,
    amount,
    keyId,
    currency = 'INR',
    name = 'Ninja Deliveries',
    description = 'Order Payment',
    prefill,
    onSuccess,
    onFailure,
  } = route.params;

  const razorpayHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .container {
                text-align: center;
                padding: 40px 20px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                color: #333;
                max-width: 400px;
                width: 90%;
            }
            .logo {
                width: 60px;
                height: 60px;
                background: #059669;
                border-radius: 50%;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: white;
                font-weight: bold;
            }
            .title {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 8px;
                color: #1a1a1a;
            }
            .subtitle {
                font-size: 16px;
                color: #64748b;
                margin-bottom: 24px;
            }
            .amount {
                font-size: 32px;
                font-weight: 800;
                color: #059669;
                margin: 20px 0;
            }
            .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                margin: 20px 0;
                color: #666;
            }
            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #e2e8f0;
                border-top: 2px solid #059669;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .button {
                background: linear-gradient(135deg, #059669 0%, #047857 100%);
                color: white;
                padding: 16px 32px;
                border: none;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                margin: 20px 0;
                width: 100%;
                box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
                transition: all 0.3s ease;
            }
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(5, 150, 105, 0.4);
            }
            .security-info {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-top: 20px;
                font-size: 12px;
                color: #64748b;
            }
            .security-icon {
                width: 16px;
                height: 16px;
                background: #059669;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">₹</div>
            <h1 class="title">Secure Payment</h1>
            <p class="subtitle">Complete your order payment</p>
            <div class="amount">₹${amount}</div>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <span>Initializing secure payment...</span>
            </div>
            
            <button class="button" onclick="startPayment()" id="payButton" style="display: none;">
                Pay ₹${amount}
            </button>
            
            <div class="security-info">
                <div class="security-icon">✓</div>
                <span>256-bit SSL encrypted • Powered by Razorpay</span>
            </div>
        </div>

        <script>
            let paymentInitialized = false;
            
            function startPayment() {
                if (paymentInitialized) return;
                paymentInitialized = true;
                
                document.getElementById('loading').style.display = 'flex';
                document.getElementById('payButton').style.display = 'none';
                
                var options = {
                    "key": "${keyId}",
                    "amount": "${amount * 100}", // Amount in paise
                    "currency": "${currency}",
                    "name": "${name}",
                    "description": "${description}",
                    "order_id": "${orderId}",
                    "prefill": {
                        "name": "${prefill?.name || ''}",
                        "email": "${prefill?.email || ''}",
                        "contact": "${prefill?.contact || ''}"
                    },
                    "theme": {
                        "color": "#059669"
                    },
                    "handler": function (response) {
                        // Payment successful
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'success',
                            data: response
                        }));
                    },
                    "modal": {
                        "ondismiss": function() {
                            // Payment cancelled
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'cancelled',
                                data: { error: 'Payment cancelled by user' }
                            }));
                        }
                    }
                };

                var rzp = new Razorpay(options);
                
                rzp.on('payment.failed', function (response) {
                    // Payment failed
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'failed',
                        data: response.error
                    }));
                });

                rzp.open();
            }

            // Initialize payment when page loads
            window.onload = function() {
                setTimeout(() => {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('payButton').style.display = 'block';
                    // Auto-start payment after a short delay
                    setTimeout(startPayment, 500);
                }, 1500);
            };
        </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'success':
          console.log('Payment successful:', data.data);
          navigation.goBack();
          if (onSuccess) {
            onSuccess(data.data);
          }
          break;
          
        case 'failed':
          console.log('Payment failed:', data.data);
          navigation.goBack();
          if (onFailure) {
            onFailure(data.data);
          }
          break;
          
        case 'cancelled':
          console.log('Payment cancelled:', data.data);
          navigation.goBack();
          if (onFailure) {
            onFailure(data.data);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
      navigation.goBack();
      if (onFailure) {
        onFailure({ error: 'Payment processing error' });
      }
    }
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleRetry = () => {
    setError(false);
    setLoading(true);
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>
            Unable to load payment gateway. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <View style={styles.headerRight}>
          <Ionicons name="shield-checkmark" size={20} color="#059669" />
        </View>
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Loading secure payment...</Text>
            <Text style={styles.loadingSubtext}>Please wait while we prepare your payment</Text>
          </View>
        </View>
      )}
      
      {/* WebView */}
      <WebView
        source={{ html: razorpayHTML }}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        style={styles.webview}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerRight: {
    padding: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
});