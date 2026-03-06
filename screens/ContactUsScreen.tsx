// screens/ContactUsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PHONE = '8219105753';
const EMAIL = 'admin@ninjadeliveries.com';

const ContactUsScreen: React.FC = () => {
  const handleCall  = () => Linking.openURL(`tel:${PHONE}`);
  const handleEmail = () => Linking.openURL(`mailto:${EMAIL}`);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* ---------- Hero (logo / mascot) ---------- */}
      <View style={styles.heroWrapper}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../assets/ninja-phone.jpg')}
            style={styles.logoImg}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.heading}>Need a hand?</Text>
        <Text style={styles.subHeading}>
          We’re always around to help with orders, feedback or questions.
        </Text>
      </View>

      {/* ---------- Action buttons ---------- */}
      <View style={styles.actionsWrapper}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
          <Icon name="phone" size={24} color="#fff" style={styles.actionIcon} />
          <Text style={styles.actionText}>Call Us</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleEmail}>
          <Icon name="email" size={24} color="#fff" style={styles.actionIcon} />
          <Text style={styles.actionText}>Email Us</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ContactUsScreen;

/* ------------------------------------------------------------------ */
/*  STYLES                                                            */
/* ------------------------------------------------------------------ */
const PRIMARY   = '#00C853';
const DARK_BG   = '#121212';
const TEXT_GREY = '#E0E0E0';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'space-between',
  },

  /* ---------- hero ---------- */
  heroWrapper: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  logoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 24,
    // subtle elevation / shadow
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logoImg: { width: '100%', height: '100%' },

  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 16,
    color: TEXT_GREY,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* ---------- actions ---------- */
  actionsWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 40,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  actionIcon: { marginRight: 14 },
  actionText: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
