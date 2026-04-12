import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadingModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  accentColor?: string;
  emoji?: string;
}

export default function LoadingModal({
  visible,
  title,
  subtitle,
  iconName = 'search-outline',
  iconColor = '#00b4a0',
  accentColor,
  emoji,
}: LoadingModalProps) {
  const bg = accentColor ?? iconColor;

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.85)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;

  // floating emoji positions
  const f1 = useRef(new Animated.Value(0)).current;
  const f2 = useRef(new Animated.Value(0)).current;
  const f3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      rotateAnim.setValue(0);
      floatAnim.setValue(0);
      [f1, f2, f3].forEach(a => a.setValue(0));
      return;
    }

    // card pop-in
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1,    duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, bounciness: 10 }),
    ]).start();

    // spin ring
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // main icon float
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue:  0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // staggered floating chips
    [[f1, 0], [f2, 300], [f3, 600]].forEach(([anim, delay]) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay as number),
          Animated.timing(anim as Animated.Value, { toValue: -8, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim as Animated.Value, { toValue:  0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, [visible]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Floating service chips */}
          <View style={styles.chipsRow}>
            {[
              { anim: f1, label: '🔧', bg: '#fff7ed' },
              { anim: f2, label: '🏠', bg: '#f0fdf4' },
              { anim: f3, label: '⚡', bg: '#fefce8' },
            ].map(({ anim, label, bg: chipBg }, i) => (
              <Animated.View key={i} style={[styles.chip, { backgroundColor: chipBg, transform: [{ translateY: anim }] }]}>
                <Text style={styles.chipEmoji}>{label}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Spinning ring + icon/emoji */}
          <View style={styles.iconWrapper}>
            <Animated.View style={[styles.spinRing, { borderColor: bg, transform: [{ rotate: spin }] }]} />
            <Animated.View style={[styles.iconInner, { backgroundColor: bg + '18', transform: [{ translateY: floatAnim }] }]}>
              {emoji
                ? <Text style={styles.emojiMain}>{emoji}</Text>
                : <Ionicons name={iconName} size={30} color={bg} />
              }
            </Animated.View>
          </View>

          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          <DotsLoader color={bg} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function DotsLoader({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    dots.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1,   duration: 380, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 380, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color, opacity: dot }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: 270,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipEmoji: {
    fontSize: 20,
  },
  iconWrapper: {
    width: 84,
    height: 84,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  spinRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiMain: {
    fontSize: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 5,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
