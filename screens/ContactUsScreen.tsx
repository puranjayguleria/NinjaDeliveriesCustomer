// screens/ContactUsScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  StatusBar,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const PHONE = '8219105753';
const EMAIL = 'admin@ninjadeliveries.com';

const ContactUsScreen: React.FC = () => {
  const navigation = useNavigation();
  const handleCall = async () => {
    try {
      const supported = await Linking.canOpenURL(`tel:${PHONE}`);
      if (supported) {
        await Linking.openURL(`tel:${PHONE}`);
      } else {
        Alert.alert("Error", "Phone calls are not supported on this device.");
      }
    } catch (err) {
      console.error("Error opening dialer:", err);
      Alert.alert("Error", "Could not open dialer.");
    }
  };

  const handleEmail = async () => {
    try {
      const supported = await Linking.canOpenURL(`mailto:${EMAIL}`);
      if (supported) {
        await Linking.openURL(`mailto:${EMAIL}`);
      } else {
        Alert.alert("Error", "Email is not supported on this device.");
      }
    } catch (err) {
      console.error("Error opening email:", err);
      Alert.alert("Error", "Could not open email app.");
    }
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ninjaScale = useRef(new Animated.Value(0.9)).current;
  const ninjaY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    // Ninja pop-in
    Animated.spring(ninjaScale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Ninja float animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(ninjaY, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ninjaY, {
          toValue: 10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={['#1F1F1F', '#000000']}
      style={styles.gradientBg}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* ---------- Header ---------- */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ---------- Hero (logo / mascot) ---------- */}
        <Animated.View style={[styles.heroWrapper, { opacity: fadeAnim }]}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: ninjaScale }, { translateY: ninjaY }],
              },
            ]}
          >
            <View style={styles.logoCircle}>
              <Image
                source={require('../assets/ninja-phone.jpg')}
                style={styles.logoImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.shadow} />
          </Animated.View>

          <Text style={styles.heading}>Contact Us</Text>
          <Text style={styles.subHeading}>
            We’re here to help — whether it’s an order, feedback, or a quick question.
          </Text>
        </Animated.View>

        {/* ---------- Action buttons ---------- */}
        <Animated.View style={[styles.actionsWrapper, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Icon name="phone" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Call Us</Text>
            <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.5)" style={styles.chevron} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.emailBtn]}
            onPress={handleEmail}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, styles.emailIconContainer]}>
              <Icon name="email" size={24} color="#fff" />
            </View>
            <Text style={styles.actionText}>Email Us</Text>
            <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.5)" style={styles.chevron} />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default ContactUsScreen;

/* ------------------------------------------------------------------ */
/*  STYLES                                                            */
/* ------------------------------------------------------------------ */
const PRIMARY   = '#00C853'; // Premium Green
const DARK_BG   = '#121212';
const TEXT_GREY = '#B0B0B0';

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  
  /* ---------- header ---------- */
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  /* ---------- hero ---------- */
  heroWrapper: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 140, // Reduced size
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  logoImg: { width: '100%', height: '100%' },
  shadow: {
    width: 100,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    marginTop: 20,
    transform: [{ scaleX: 1.5 }],
    opacity: 0.6,
  },

  heading: {
    fontSize: 36, // Increased size
    fontWeight: '800', // Heavy weight
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subHeading: {
    fontSize: 15, // Slightly smaller
    color: TEXT_GREY,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400', // Lighter weight
    maxWidth: '85%',
  },

  /* ---------- actions ---------- */
  actionsWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16, // Consistent spacing
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E', // Darker card-like background
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 72, // Taller touch target
  },
  emailBtn: {
    marginTop: 0,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  emailIconContainer: {
    backgroundColor: '#2E7D32', // Slightly darker green for email
  },
  actionText: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  chevron: {
    marginLeft: 8,
  },
});
