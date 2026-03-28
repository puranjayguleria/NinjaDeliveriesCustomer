import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  style?: ViewStyle;
  borderRadius?: number;
}

const SkeletonItem: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  style,
  borderRadius = 4,
}) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height: height as any, borderRadius },
        style,
        animatedStyle,
      ]}
    />
  );
};

const ProductSkeleton = () => {
  const cardWidth = (width - 32) / 2; // Assuming 2 columns with padding

  return (
    <View style={styles.cardContainer}>
      <SkeletonItem width="100%" height={120} borderRadius={8} style={{ marginBottom: 8 }} />
      <SkeletonItem width="80%" height={16} style={{ marginBottom: 6 }} />
      <SkeletonItem width="60%" height={16} style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <SkeletonItem width={60} height={20} />
        <SkeletonItem width={30} height={20} />
      </View>
    </View>
  );
};

const ProductGridSkeleton = () => {
  return (
    <View style={styles.gridContainer}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.gridItem}>
          <ProductSkeleton />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardContainer: {
    width: '100%',
  },
});

export { SkeletonItem, ProductSkeleton, ProductGridSkeleton };
export default SkeletonItem;
