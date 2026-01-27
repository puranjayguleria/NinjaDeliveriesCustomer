import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';

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

  const {
    orderId,
    amount,
    keyId,
    currency = 'INR',
    name = 'Ninja Services',
    description = 'Service Payment',
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
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f5f5f5;
            }
            .container {
                text-align: center;
                padding: 20px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .loading {
                color: #666;
                margin: 20px 0;
            }
            .button {
                background-color: #4CAF50;
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
                margin: 10px;
            }
            .button:hover {
                background-color: #45a049;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Secure Payment</h2>
            <p class="loading">Initializing payment gateway...</p>
            <button class="button" onclick="startPayment()">Pay ₹${amount}</button>
        </div>

        <script>
            function startPayment() {
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
                        "color": "#4CAF50"
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

            // Auto-start payment when page loads
            window.onload = function() {
                setTimeout(startPayment, 1000);
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

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}
      
      <WebView
        source={{ html: razorpayHTML }}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1000,
  },
  webview: {
    flex: 1,
  },
});