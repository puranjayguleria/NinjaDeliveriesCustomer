/**
 * LoadingModal — flicker-free full-screen loading overlay.
 *
 * Uses an absolute-positioned View instead of React Native's <Modal> to avoid
 * the unmount/remount flash that Modal causes on every show/hide cycle.
 * The overlay fades in/out smoothly and is rendered on top of everything via
 * a high zIndex.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

interface LoadingModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  accentColor?: string;
  emoji?: string;
  /** Custom floating chips. Defaults to service icons if not provided. */
  chips?: { label: string; bg: string }[];
}

// Default chip sets
const SERVICE_CHIPS = [
  { label: '🔧', bg: '#fff7ed' },
  { label: '🏠', bg: '#f0fdf4' },
  { label: '⚡', bg: '#fefce8' },
];

const GROCERY_CHIPS = [
  { label: '🥦', bg: '#f0fdf4' },
  { label: '🛒', bg: '#eff6ff' },
  { label: '🥛', bg: '#fefce8' },
];

export default function LoadingModal({
  visible,
  title,
  subtitle,
  iconName = 'search-outline',
  iconColor = '#00b4a0',
  accentColor,
  emoji,
  chips,
}: LoadingModalProps) {
  const bg = accentColor ?? iconColor;
  const chipData = chips ?? SERVICE_CHIPS;

  // Keep overlay mounted but hidden — avoids any mount/unmount flash
  const [mounted, setMounted] = useState(visible);

  const fadeAnim  = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;
  const f1 = useRef(new Animated.Value(0)).current;
  const f2 = useRef(new Animated.Value(0)).current;
  const f3 = useRef(new Animated.Value(0)).current;

  const loopRefs = useRef<Animated.CompositeAnimation[]>([]);

  const stopLoops = () => {
    loopRefs.current.forEach(l => l.stop());
    loopRefs.current = [];
  };

  const startLoops = () => {
    stopLoops();

    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue:  0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    const chips = [f1, f2, f3].map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 280),
          Animated.timing(anim, { toValue: -8, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue:  0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );

    loopRefs.current = [spin, float, ...chips];
    loopRefs.current.forEach(l => l.start());
  };

  useEffect(() => {
    if (visible) {
      // Mount first, then animate in on next frame
      setMounted(true);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            bounciness: 6,
            speed: 16,
          }),
        ]).start();
        startLoops();
      });
    } else {
      // Animate out, then unmount
      stopLoops();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          // Reset for next show
          rotateAnim.setValue(0);
          floatAnim.setValue(0);
          f1.setValue(0);
          f2.setValue(0);
          f3.setValue(0);
        }
      });
    }

    return stopLoops;
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="auto"
    >

      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Floating chips */}
        <View style={styles.chipsRow}>
          {chipData.map(({ label, bg: chipBg }, i) => (
            <Animated.View
              key={i}
              style={[styles.chip, { backgroundColor: chipBg, transform: [{ translateY: [f1, f2, f3][i] }] }]}
            >
              <Text style={styles.chipEmoji}>{label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Spinning ring + icon */}
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[styles.spinRing, { borderColor: bg, transform: [{ rotate: spin }] }]}
          />
          <Animated.View
            style={[
              styles.iconInner,
              { backgroundColor: bg + '18', transform: [{ translateY: floatAnim }] },
            ]}
          >
            {emoji
              ? <Text style={styles.emojiMain}>{emoji}</Text>
              : <Ionicons name={iconName} size={30} color={bg} />
            }
          </Animated.View>
        </View>

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <DotsLoader color={bg} />
      </Animated.View>
    </Animated.View>
  );
}

// ── Dots ─────────────────────────────────────────────────────────────────────
function DotsLoader({ color }: { color: string }) {
  const d0 = useRef(new Animated.Value(0.3)).current;
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anims = [d0, d1, d2].map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1,   duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 320, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.dotsRow}>
      {[d0, d1, d2].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: color, opacity: dot }]}
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Cover full screen including status bar
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: 'rgba(15,23,42,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    // Sit above everything — tabs, headers, modals
    zIndex: 9999,
    elevation: 9999,
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
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
  chipEmoji: { fontSize: 20 },
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
  emojiMain: { fontSize: 28 },
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
