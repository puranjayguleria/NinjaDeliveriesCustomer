import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useToggleContext } from "@/context/ToggleContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const FoodComingSoonScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { activeMode, setActiveMode } = useToggleContext();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle continuous rotation for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-10deg", "10deg"],
  });

  const handleHomePress = () => {
    // Force the global mode back to grocery.
    // Since this component is rendered by HomeScreenWrapper in App.tsx,
    // changing the mode will automatically switch the view back to ProductsHomeScreen.
    setActiveMode("grocery");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={["#FFFFFF", "#F8FAFC"]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleHomePress}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>

        {/* Mode Toggle Bar */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeMode === "grocery" && styles.toggleBtnActive,
            ]}
            onPress={() => {
               setActiveMode("grocery");
               // Force navigation reset to ensure screen change
               navigation.reset({
                 index: 0,
                 routes: [{ name: "ProductsHome" }],
               });
             }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name="basket" 
              size={15} 
              color={activeMode === "grocery" ? "#00b4a0" : "#6B7280"} 
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.toggleLabel,
                activeMode === "grocery" && styles.toggleLabelActive,
              ]}
            >
              Grocery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeMode === "service" && styles.toggleBtnActive,
            ]}
            onPress={() => {
              setActiveMode("service");
              // Force navigation reset to ensure screen change
              navigation.reset({
                index: 0,
                routes: [{ name: "ProductsHome" }],
              });
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name="hammer-wrench" 
              size={15} 
              color={activeMode === "service" ? "#00b4a0" : "#6B7280"} 
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.toggleLabel,
                activeMode === "service" && styles.toggleLabelActive,
              ]}
            >
              Service
            </Text>
            {/* New Badge */}
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeMode === "food" && styles.toggleBtnActive,
            ]}
            onPress={() => {
              setActiveMode("food");
              // Force navigation reset to ensure screen change
              navigation.reset({
                index: 0,
                routes: [{ name: "ProductsHome" }],
              });
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name="food" 
              size={15} 
              color={activeMode === "food" ? "#00b4a0" : "#6B7280"} 
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.toggleLabel,
                activeMode === "food" && styles.toggleLabelActive,
              ]}
            >
              Food
            </Text>
            {/* Coming Soon Badge */}
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>SOON</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.illustrationContainer, 
            { 
              opacity: fadeAnim, 
              transform: [{ scale: scaleAnim }, { rotate: rotation }] 
            }
          ]}
        >
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="food-variant" size={80} color="#FF6B6B" />
          </View>
          <View style={[styles.floatingIcon, styles.icon1]}>
            <MaterialCommunityIcons name="pizza" size={30} color="#FFD93D" />
          </View>
          <View style={[styles.floatingIcon, styles.icon2]}>
            <MaterialCommunityIcons name="hamburger" size={34} color="#FF8E3C" />
          </View>
          <View style={[styles.floatingIcon, styles.icon3]}>
            <MaterialCommunityIcons name="noodle" size={28} color="#4D96FF" />
          </View>
        </Animated.View>

        <Animated.View 
          style={[
            styles.textContainer, 
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Text style={styles.title}>Food Delivery</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>COMING SOON</Text>
          </View>
          <Text style={styles.subtitle}>
            We're currently seasoning our menu to bring you the most delicious flavors in town. Get ready for a feast!
          </Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.footer, 
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={handleHomePress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#00b4a0", "#009688"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Ionicons name="home" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.buttonText}>Back to Home</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    padding: 16,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
  },
  toggleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.01)",
    height: 38,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "transparent",
  },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.1,
  },
  toggleLabelActive: {
    color: "#00b4a0",
  },
  newBadge: {
    position: "absolute",
    top: -6,
    right: 0,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  soonBadge: {
    position: "absolute",
    top: -6,
    right: 4,
    backgroundColor: "#FF9500",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  soonBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginTop: -40,
  },
  illustrationContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#FFF5F5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  floatingIcon: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon1: {
    top: 0,
    right: 0,
  },
  icon2: {
    bottom: 20,
    left: -10,
  },
  icon3: {
    top: 30,
    left: -20,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  badge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  footer: {
    width: "100%",
  },
  homeButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});

export default FoodComingSoonScreen;
