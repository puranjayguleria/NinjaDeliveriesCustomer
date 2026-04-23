import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MaintenanceModalProps {
  visible: boolean;
  onClose?: () => void;
  onChangeLocation?: () => void;
  unavailableServices?: {
    grocery?: boolean;
    services?: boolean;
    food?: boolean;
  };
  onNavigateToService?: (service: 'grocery' | 'services' | 'food') => void;
}

const { width } = Dimensions.get('window');

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ 
  visible, 
  onClose,
  onChangeLocation, 
  unavailableServices,
  onNavigateToService 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const gearAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  // Get list of unavailable services (false means unavailable)
  const getUnavailableServiceNames = () => {
    const services = [];
    if (unavailableServices?.grocery === false) services.push('Grocery');
    if (unavailableServices?.services === false) services.push('Services');
    if (unavailableServices?.food === false) services.push('Food');
    return services;
  };

  // Get list of available services (true means available)
  const getAvailableServices = () => {
    const services: Array<{ key: 'grocery' | 'services' | 'food'; name: string; icon: string }> = [];
    if (unavailableServices?.grocery === true) {
      services.push({ key: 'grocery', name: 'Grocery', icon: 'basket-outline' });
    }
    if (unavailableServices?.services === true) {
      services.push({ key: 'services', name: 'Services', icon: 'construct-outline' });
    }
    if (unavailableServices?.food === true) {
      services.push({ key: 'food', name: 'Food', icon: 'restaurant-outline' });
    }
    return services;
  };

  const unavailableServiceNames = getUnavailableServiceNames();
  const availableServices = getAvailableServices();
  const hasUnavailableServices = unavailableServiceNames.length > 0;
  const allServicesUnavailable = unavailableServiceNames.length === 3;

  useEffect(() => {
    if (visible) {
      // Entry animation
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();

      // Gear spin
      Animated.loop(
        Animated.timing(gearAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
      ).start();

      // Pulse on icon bg
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();

      // Loading dots
      const dotDelay = 300;
      const animateDot = (dot: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            Animated.delay(dotDelay * 2),
          ])
        ).start();

      animateDot(dotAnim1, 0);
      animateDot(dotAnim2, dotDelay);
      animateDot(dotAnim3, dotDelay * 2);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const gearRotate = gearAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }, { translateY: slideAnim }] },
          ]}
        >
          {/* Close button */}
          {onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          )}

          {/* Background blobs */}
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View style={[styles.blob, styles.blob1]} />
            <View style={[styles.blob, styles.blob2]} />
          </View>

          {/* Icon */}
          <Animated.View style={[styles.iconRing, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['#fee2e2', '#fecaca']}
              style={styles.iconBg}
            >
              <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
                <Ionicons name="location-outline" size={44} color="#dc2626" />
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>
            {unavailableServiceNames.includes('Grocery') && !unavailableServiceNames.includes('Services')
              ? 'Grocery Not Available'
              : unavailableServiceNames.includes('Services') && !unavailableServiceNames.includes('Grocery')
                ? 'Services Not Available'
                : unavailableServiceNames.length > 0
                  ? 'Some Services Unavailable'
                  : 'Service Not Available'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {unavailableServiceNames.length > 0 
              ? `Ninja deliveries ${unavailableServiceNames.join(', ')} ${unavailableServiceNames.length === 1 ? 'is' : 'are'} not yet available in your area.`
              : 'This service is not yet available in your area.'
            }
          </Text>

          {/* Loading dots */}
          <View style={styles.dotsRow}>
            {[dotAnim1, dotAnim2, dotAnim3].map((dot, i) => (
              <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
            ))}
          </View>

          {/* Available Services Buttons */}
          {availableServices.length > 0 && onNavigateToService && (
            <View style={styles.availableServicesBox}>
              <Text style={styles.availableServicesTitle}>Available in your area:</Text>
              {availableServices.map((service) => {
                const isFood = service.key === 'food';
                const gradientColors: [string, string] = isFood
                  ? ['#f97316', '#ea580c']
                  : ['#0d9488', '#0f766e'];
                const iconColor = isFood ? '#f97316' : '#0d9488';
                const shadowColor = isFood ? '#f97316' : '#0d9488';
                return (
                  <TouchableOpacity
                    key={service.key}
                    style={[styles.serviceButton, { shadowColor }]}
                    onPress={() => onNavigateToService(service.key)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.serviceButtonGradient}
                    >
                      <View style={styles.serviceButtonIcon}>
                        <Ionicons name={service.icon as any} size={20} color={iconColor} />
                      </View>
                      <Text style={styles.serviceButtonText}>{service.name}</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Change location button */}
          {onChangeLocation && (
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={onChangeLocation}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.locationBtnGradient}
              >
                <Ionicons name="location-outline" size={18} color="#fff" />
                <Text style={styles.locationBtnText}>Change Location</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: width * 0.92,
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.05,
  },
  blob1: {
    width: 180,
    height: 180,
    backgroundColor: '#f59e0b',
    top: -60,
    right: -60,
  },
  blob2: {
    width: 120,
    height: 120,
    backgroundColor: '#0d9488',
    bottom: -40,
    left: -40,
  },
  iconRing: {
    marginBottom: 16,
    borderRadius: 999,
    padding: 6,
    backgroundColor: 'rgba(253, 230, 138, 0.3)',
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 16,
    gap: 6,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0d9488',
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  locationBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  locationBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  locationBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  footer: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  availableServicesBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  availableServicesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    textAlign: 'center',
  },
  serviceButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  serviceButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    marginLeft: 12,
  },
  unavailableServicesBox: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  unavailableServicesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  unavailableServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  unavailableServiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableServiceText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
  },
  unavailableServiceStatus: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  unavailableServiceStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
});

export default MaintenanceModal;
