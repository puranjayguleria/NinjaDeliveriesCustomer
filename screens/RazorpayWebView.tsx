import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation, StackActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from "expo-linking";
import { finalizeRazorpayWebViewCallbacks, getRazorpayWebViewCallbacks } from "../utils/razorpayWebViewCallbacks";

export default function RazorpayWebView() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);

  const webViewRef = useRef<WebView>(null);
  const lastNavUrlRef = useRef<string>("about:blank");
  const allowExitRef = useRef(false);
  const lastReloadAtRef = useRef<number>(0);
  const didFinalizeRef = useRef(false);

  // IMPORTANT:
  // In this app, navigators typically hide the native header for this screen.
  // So we render a small in-screen header with a back button.

  const log = (...args: any[]) => {
    if (__DEV__) console.log("🌐[RZPWebView]", ...args);
  };

  const {
    orderId,
    amount,
    keyId,
    currency = 'INR',
    name = 'Ninja Deliveries',
    description = 'Order Payment',
    prefill,
    sessionId,
  } = route.params;

  const { onSuccess, onFailure } = getRazorpayWebViewCallbacks(sessionId);

  const finalizeOnce = useCallback(() => {
    if (didFinalizeRef.current) return;
    didFinalizeRef.current = true;
    finalizeRazorpayWebViewCallbacks(sessionId);
  }, [sessionId]);

  const popAllRazorpayScreens = useCallback(() => {
    try {
      const state = navigation.getState?.();
      const routes: { name?: string }[] = (state?.routes ?? []) as any;
      let popCount = 0;
      for (let i = routes.length - 1; i >= 0; i--) {
        if (routes[i]?.name === 'RazorpayWebView') popCount++;
        else break;
      }
      if (popCount > 0) {
        navigation.dispatch(StackActions.pop(popCount));
        return true;
      }
    } catch (e) {
      console.warn('[RZPWebView] popAllRazorpayScreens failed:', e);
    }
    return false;
  }, [navigation]);

  const exitPaymentScreen = useCallback(() => {
    allowExitRef.current = true;
    // Pop all consecutive RazorpayWebView screens, so we never reveal another Razorpay screen underneath.
    if (!popAllRazorpayScreens()) {
      navigation.goBack();
    }
  }, [navigation, popAllRazorpayScreens]);

  log("mount", { orderId, amount, currency, name, description });

  const maybeOpenExternal = useCallback((urlRaw: string) => {
    const url = String(urlRaw || "");
    if (!url) return false;

    // Never attempt to open internal about:* URLs externally.
    if (url.startsWith("about:")) return false;

    // Allow http(s) to stay in WebView.
    if (url.startsWith("http://") || url.startsWith("https://")) return false;

    // Allow data/blob to stay in WebView.
    if (url.startsWith("data:") || url.startsWith("blob:")) return false;

    // Common external schemes.
    if (url.startsWith("tel:") || url.startsWith("mailto:")) {
      log("nav_open_external", { url });
      Linking.openURL(url).catch((e) => {
        console.warn("[RZPWebView] Error opening URL:", e);
      });
      return true;
    }

    // For UPI / intent links, try opening externally.
    if (
      url.startsWith("intent:") ||
      url.startsWith("upi:") ||
      url.startsWith("tez:") ||
      url.startsWith("phonepe:") ||
      url.startsWith("paytmmp:") ||
      url.startsWith("paytm:") ||
      url.startsWith("gpay:") ||
      url.startsWith("bhim:") ||
      url.startsWith("cred:") ||
      url.startsWith("mobikwik:") ||
      url.startsWith("freecharge:")
    ) {
      log("nav_open_external", { url });
      Linking.openURL(url).catch((e) => {
        console.warn("[RZPWebView] Error opening URL:", e);
      });
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    // Prevent accidental exits while payment is in progress.
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // If we are already in an error state, allow leaving, but still notify the parent
      // so it can stop any loaders.
      if (error && !allowExitRef.current) {
        allowExitRef.current = true;
        try {
          onFailure?.({
            code: 'PAYMENT_WEBVIEW_ERROR',
            error: 'Payment gateway failed to load',
            description: 'Payment gateway failed to load',
            source: 'webview_error',
          });
        } catch (cbErr) {
          console.warn('[RZPWebView] onFailure callback threw:', cbErr);
        }
        finalizeOnce();
        return;
      }

      // Allow programmatic exits (success/failure/cancel flows).
      if (allowExitRef.current) return;

      e.preventDefault();
      Alert.alert(
        'Cancel payment?',
        'Are you sure you want to go back? Your payment may not be completed.',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => {
              // Treat explicit user exit as a cancellation so the parent screen can
              // stop any loaders and remain usable.
              try {
                onFailure?.({
                  code: 'PAYMENT_CANCELLED',
                  error: 'Payment cancelled by user',
                  description: 'Payment cancelled by user',
                  source: 'user_exit',
                });
              } catch (cbErr) {
                console.warn('[RZPWebView] onFailure callback threw:', cbErr);
              }
              finalizeOnce();
              exitPaymentScreen();
            },
          },
        ]
      );
    });

    const onHardwareBack = () => {
      // Let react-navigation handle it (and trigger beforeRemove).
      navigation.goBack();
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

    return () => {
      unsubscribe?.();
      backSub.remove();
    };
  }, [navigation, error, onFailure, finalizeOnce, exitPaymentScreen]);

  const reloadWebView = useCallback((reason: string) => {
    const now = Date.now();
    if (now - lastReloadAtRef.current < 5000) {
      log('reload_throttled', { reason });
      return;
    }

    lastReloadAtRef.current = now;
    log('reload_webview', { reason });
    setLoading(true);
    setWebViewKey((k) => k + 1);
  }, []);

  const injectDomProbe = useCallback(() => {
    // Probe whether the current document is actually blank.
    // This avoids relying on URL values like about:blank which can be valid for html sources.
    const js = `
(function () {
  try {
    var body = document.body;
    var text = body && body.innerText ? String(body.innerText) : '';
    var isBlank = !body || ((body.children ? body.children.length : 0) === 0 && text.trim().length === 0);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dom_probe', isBlank: isBlank }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dom_probe', isBlank: true, error: String(e) }));
  }
})();
true;
`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

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

      log("message", data);
      
      switch (data.type) {
        case 'dom_probe': {
          if (data?.isBlank && (lastNavUrlRef.current === 'about:blank' || !lastNavUrlRef.current)) {
            reloadWebView('dom_blank');
          }
          break;
        }
        case 'success':
          log('success', data.data);
          if (onSuccess) {
            log('calling_onSuccess');
            try {
              onSuccess(data.data);
            } catch (cbErr) {
              console.warn('[RZPWebView] onSuccess callback threw:', cbErr);
            }
          }
          finalizeOnce();
          exitPaymentScreen();
          break;
          
        case 'failed':
          log('failed', data.data);
          if (onFailure) {
            log('calling_onFailure_failed');
            try {
              onFailure(data.data);
            } catch (cbErr) {
              console.warn('[RZPWebView] onFailure callback threw:', cbErr);
            }
          }
          finalizeOnce();
          exitPaymentScreen();
          break;
          
        case 'cancelled':
          log('cancelled', data.data);
          if (onFailure) {
            log('calling_onFailure_cancelled');
            try {
              onFailure(data.data);
            } catch (cbErr) {
              console.warn('[RZPWebView] onFailure callback threw:', cbErr);
            }
          }
          finalizeOnce();
          exitPaymentScreen();
          break;
      }
    } catch (error) {
      log('parse_error', error);
      if (onFailure) {
        try {
          onFailure({ error: 'Payment processing error' });
        } catch (cbErr) {
          console.warn('[RZPWebView] onFailure callback threw:', cbErr);
        }
      }
      finalizeOnce();
      exitPaymentScreen();
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              allowExitRef.current = true;
              try {
                onFailure?.({
                  code: 'PAYMENT_WEBVIEW_ERROR',
                  error: 'Payment gateway failed to load',
                  description: 'Payment gateway failed to load',
                  source: 'webview_error',
                });
              } catch (cbErr) {
                console.warn('[RZPWebView] onFailure callback threw:', cbErr);
              }
              finalizeOnce();
              exitPaymentScreen();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>
            Unable to load payment gateway. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              allowExitRef.current = true;
              try {
                onFailure?.({
                  code: 'PAYMENT_WEBVIEW_ERROR',
                  error: 'Payment gateway failed to load',
                  description: 'Payment gateway failed to load',
                  source: 'webview_error',
                });
              } catch (cbErr) {
                console.warn('[RZPWebView] onFailure callback threw:', cbErr);
              }
              finalizeOnce();
              exitPaymentScreen();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.body}>
        {/* Loading Overlay (only covers WebView area, not the header) */}
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
          ref={webViewRef}
          key={webViewKey}
          source={{ html: razorpayHTML }}
          onMessage={handleMessage}
          onLoadEnd={() => {
            setLoading(false);
            injectDomProbe();
          }}
          onError={handleError}
          onNavigationStateChange={(navState) => {
            const url = String(navState?.url || '');
            lastNavUrlRef.current = url || 'about:blank';
          }}
          setSupportMultipleWindows={false}
          onOpenWindow={(event) => {
            const targetUrl = String(event?.nativeEvent?.targetUrl || "");
            log("open_window", { url: targetUrl });

            // Razorpay sometimes opens internal iframe srcdoc in a new window.
            if (targetUrl.startsWith("about:")) {
              log("open_window_block_about", { url: targetUrl });
              return;
            }

            const didOpenExternal = maybeOpenExternal(targetUrl);
            if (!didOpenExternal) {
              log("open_window_ignored", { url: targetUrl });
            }
          }}
          onShouldStartLoadWithRequest={(req) => {
            const url = String(req?.url || "");

            if (url.startsWith("about:")) {
              log("nav_allow_about", { url });
              return true;
            }

            if (url.startsWith("http://") || url.startsWith("https://")) {
              return true;
            }

            if (url.startsWith("data:") || url.startsWith("blob:")) {
              return true;
            }

            if (url.startsWith("tel:") || url.startsWith("mailto:")) {
              maybeOpenExternal(url);
              return false;
            }

            if (maybeOpenExternal(url)) {
              return false;
            }

            log("nav_block_unknown", { url });
            return false;
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          style={styles.webview}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  body: {
    flex: 1,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '500',
  },
});