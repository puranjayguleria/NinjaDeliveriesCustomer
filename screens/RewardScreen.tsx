import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import firestore from "@react-native-firebase/firestore"; // ✅ Native Firebase Firestore
import auth from "@react-native-firebase/auth"; // ✅ To get current user
import { SafeAreaView } from "react-native-safe-area-context";
import { RFValue } from "react-native-responsive-fontsize";
import { BlurView } from "expo-blur";

export default function HiddenCouponCard() {
  const [userId, setUserId] = useState(null);

  /*-----------------For CouponCode Detail Model---------------------*/
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  /*----------------For CouponCode List In Flatlist-------------------*/
  const [couponList, setCouponList] = useState([]);

  /*----------------For Side Visiblity Of Coupon Code------------------ */
  const [revealed, setRevealed] = useState({});

  /*----------------To Change Copy To Copied (Button)------------------*/
  const [copied, setCopied] = useState("COPY");

  /*--------------------------For Loader------------------------------ */
  const [loading, setLoading] = useState(false);

  // ✅ Get current user dynamically
  useEffect(() => {
    const currentUser = auth().currentUser;
    console.log("[HiddenCouponCard] currentUser:", currentUser?.uid);
    setUserId(currentUser?.uid || null);
  }, []);

  /*------------------Getting data from user and coupons-----------------------*/
  useEffect(() => {
    if (!userId) return; // Wait for userId

    setLoading(true);
    const unsubscribe = firestore()
      .collection("users")
      .doc(userId)
      .onSnapshot(async (docSnap) => {
        if (docSnap.exists) {
          const userData = docSnap.data();
          const userCoupons = userData.coupons || [];

          try {
            const fetchedCoupons = [];
            for (let c of userCoupons) {
              if (!c.couponId) continue;
              const snap = await firestore()
                .collection("coupons")
                .doc(c.couponId)
                .get();
              if (snap.exists) {
                fetchedCoupons.push({
                  ...snap.data(),
                  ...c,
                });
              }
            }
            setCouponList(fetchedCoupons);
            setLoading(false);
          } catch (error) {
            Alert.alert("Error", "Failed to load coupons.");
            setLoading(false);
          }
        } else {
          setCouponList([]);
          setLoading(false);
        }
      });

    return () => unsubscribe();
  }, [userId]);

  /*---------------Function to copy couponCode in clipboard----------------- */
  const copyToClipboard = useCallback((code) => {
    Clipboard.setStringAsync(code);
    setCopied("COPIED");
    setTimeout(() => {
      setCopied("COPY");
    }, 3000);
  }, []);

  return (
    /*------------------------------------------------------------------------------*/
    /*                           HiddenCouponCard Screen                            */
    /*------------------------------------------------------------------------------*/
    <SafeAreaView>
      <Text
        style={{
          fontSize: RFValue(23),
          alignSelf: "center",
          marginTop: "5%",
          marginBottom: "3%",
        }}
      >
        Rewards
      </Text>
      <View style={{ height: "85%" }}>
        {/*--------------------------LOADER------------------------------- */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
            <Text style={styles.text}>Fetching your exclusive coupon...</Text>
          </View>
        ) : (
          /*----------------------------COUPONLIST--------------------------- */
          <FlatList
            data={couponList}
            keyExtractor={(item) => item.couponId}
            ListEmptyComponent={() =>
              !loading && (
                <View style={{ alignItems: "center", marginTop: RFValue(40) }}>
                  <Text style={{ color: "#94A3B8", fontSize: RFValue(16) }}>
                    No rewards available at the moment.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const isRevealed = revealed[item.couponId];

              return (
                /*----------------------------------------------------------------------------------------*/
                /*                                      COUPON-CODE                                       */
                /*----------------------------------------------------------------------------------------*/
                <Pressable
                  style={[styles.card]}
                  android_ripple={{ color: "#f1f5f9" }}
                >
                  {!item.isActive && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: "100%",
                        zIndex: 99,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: RFValue(14),
                        overflow: "hidden",
                      }}
                    >
                      {/* Blur Glass Background */}
                      <BlurView
                        intensity={50}
                        tint="dark"
                        style={{ ...StyleSheet.absoluteFillObject }}
                      />

                      {/* Glowing Red Badge */}
                      <View
                        style={{
                          backgroundColor: "rgba(255, 56, 56, 0.9)",
                          paddingHorizontal: RFValue(24),
                          paddingVertical: RFValue(10),
                          borderRadius: RFValue(50),
                          borderWidth: RFValue(1),
                          borderColor: "#fff",
                          shadowColor: "red",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.4,
                          shadowRadius: RFValue(10),
                          elevation: RFValue(8),
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        {/* Expired Icon */}
                        <Feather
                          name="alert-circle"
                          size={18}
                          color="white"
                          style={{ marginRight: 8 }}
                        />

                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: RFValue(15),
                            fontWeight: "bold",
                            letterSpacing: 1,
                          }}
                        >
                          EXPIRED
                        </Text>
                      </View>
                    </View>
                  )}
                  {/*--------------------TAP TO REVEAL SIDE OF COUPON-CODE--------------------*/}

                  {!isRevealed ? (
                    <View style={styles.revealContainer}>
                      <Text style={styles.heading}>Unlock Your Coupon</Text>
                      <Text style={styles.subtext}>
                        A special deal awaits you
                      </Text>
                      <View style={styles.divider} />
                      {item.isActive ? (
                        <Pressable
                          style={styles.revealButton}
                          onPress={() => {
                            !isRevealed &&
                              setRevealed((prev) => ({
                                ...prev,
                                [item.couponId]: true,
                              }));
                          }}
                        >
                          <Text style={styles.revealText}>TAP TO REVEAL</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[
                            styles.revealButton,
                            { backgroundColor: "#FDE8E8" },
                          ]}
                        >
                          <Text
                            style={[styles.revealText, { color: "#b91c1c71" }]}
                          >
                            EXPIRED
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    /*--------------------------------------COUPON-CODE SIDE OF COUPON------------------------------------------------*/
                    <View style={{ zIndex: 1 }}>
                      <View
                        style={{
                          paddingHorizontal: RFValue(16),
                          paddingVertical: RFValue(12),
                          backgroundColor: item.isClaimed
                            ? "#636367ce"
                            : "#F7FAFC",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          {item.image && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <Image
                                source={{ uri: item.image }}
                                style={{
                                  width: RFValue(40),
                                  height: RFValue(30),
                                  borderRadius: RFValue(2),
                                  marginBottom: RFValue(10),
                                }}
                                resizeMode="cover"
                              />
                              <Text
                                style={[
                                  {
                                    marginLeft: RFValue(6),
                                    color: "#475569",
                                    fontWeight: 600,
                                    fontSize: RFValue(15),
                                  },
                                ]}
                              >
                                {item.businessName}
                              </Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.validity,
                              {
                                color: item.isActive ? "#38A169" : "#B91C1C",
                                backgroundColor: item.isActive
                                  ? "#ECFDF5"
                                  : "#FDE8E8",
                              },
                            ]}
                          >
                            {item.validUntil
                              ?.toDate()
                              .toLocaleDateString("en-GB", {
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                              }) || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.rowBetween}>
                          <Text style={styles.title}>{item.title}</Text>
                        </View>

                        <Text style={styles.description}>
                          {item.description}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: RFValue(5),
                          }}
                        >
                          <Text style={styles.minOrder}>
                            Min order: ₹{item.minOrderValue}
                          </Text>
                          <Pressable
                            onPress={() => {
                              setSelectedCoupon(item);
                              setModalVisible(true);
                            }}
                            style={styles.viewDetailsButton}
                          >
                            <Feather name="info" size={15} color="#1E3A8A" />
                            <Text style={styles.viewDetailsText}>
                              See Offer Details
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {item.isClaimed ? (
                        <View
                          style={{
                            backgroundColor: "#2A4365",
                            paddingVertical: RFValue(16),
                            paddingHorizontal: RFValue(16),
                            borderTopWidth: 0.5,
                            borderColor: "#E2E8F0",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: RFValue(15),
                              fontWeight: "700",
                              color: "#f0b9abff",
                              letterSpacing: 1.2,
                              textTransform: "uppercase",
                            }}
                          >
                            Already used
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: RFValue(12),
                            paddingHorizontal: RFValue(16),
                            backgroundColor: "#2A4365",
                            borderTopWidth: 0.5,
                            borderColor: "#E2E8F0",
                          }}
                        >
                          <Text style={styles.code}>{item.code}</Text>
                          <Pressable
                            onPress={() => copyToClipboard(item.code)}
                            style={styles.copyButton}
                          >
                            <Text style={styles.copyText}>{copied}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            }}
            contentContainerStyle={{ paddingBottom: RFValue(40) }}
          />
        )}
        {/*--------------------------------------------------------------------------------------------------------------*/}
        {/*                                            COUPON-CODE DETAIL MODEL                                           */}
        {/*--------------------------------------------------------------------------------------------------------------*/}
        {selectedCoupon && (
          <Modal
            visible={modalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
            statusBarTranslucent
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.45)",
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: RFValue(16),
              }}
            >
              <SafeAreaView
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: RFValue(20),
                  width: "100%",

                  padding: RFValue(24),
                  position: "relative",
                  elevation: RFValue(10),
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: RFValue(12),
                }}
              >
                {/* Exclusive Deal Badge */}
                <View
                  style={{
                    backgroundColor: "#FFF4E5",
                    alignSelf: "flex-start",
                    paddingHorizontal: RFValue(12),
                    paddingVertical: RFValue(4),
                    borderRadius: RFValue(6),
                    marginBottom: RFValue(12),
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: "#C05621",
                      fontWeight: "600",
                      fontSize: RFValue(12),
                    }}
                  >
                    EXCLUSIVE DEAL
                  </Text>
                </View>

                {/* Brand + Image */}
                {selectedCoupon?.image && (
                  <Image
                    source={{ uri: selectedCoupon.image }}
                    style={{
                      width: "100%",
                      height: RFValue(140),
                      borderRadius: RFValue(10),
                      backgroundColor: "#F1F5F9",
                      marginBottom: RFValue(20),
                    }}
                    resizeMode="cover"
                  />
                )}

                {/* Title */}
                <Text
                  style={{
                    fontSize: RFValue(20),
                    fontWeight: "700",
                    color: "#0F172A",
                    textAlign: "center",
                    marginBottom: RFValue(4),
                  }}
                >
                  {selectedCoupon.title}
                </Text>

                {/* Description */}
                <Text
                  style={{
                    fontSize: RFValue(14),
                    color: "#475569",
                    textAlign: "center",
                    marginBottom: RFValue(16),
                  }}
                >
                  {selectedCoupon.description}
                </Text>

                {/* Offer Details */}
                <Text
                  style={{
                    fontSize: RFValue(15),
                    fontWeight: "700",
                    color: "#1E293B",
                    marginBottom: RFValue(10),
                  }}
                >
                  Offer Details
                </Text>

                <View style={{ marginBottom: RFValue(20) }}>
                  {selectedCoupon.details?.map((detail, index) => (
                    <Text
                      key={index}
                      style={{
                        fontSize: RFValue(13.5),
                        color: "#334155",
                        marginBottom: RFValue(6),
                      }}
                    >
                      • {detail}
                    </Text>
                  ))}
                </View>

                {/* Coupon Code */}
                <View
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: RFValue(10),
                    paddingVertical: RFValue(14),
                    paddingHorizontal: RFValue(18),
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                    marginBottom: RFValue(18),
                  }}
                >
                  <Text
                    style={{
                      fontSize: RFValue(15),
                      color: "#64748B",
                      fontWeight: "600",
                    }}
                  >
                    Coupon Code:
                  </Text>
                  <Text
                    style={{
                      fontSize: RFValue(16),
                      fontWeight: "bold",
                      color: "#1E293B",
                      letterSpacing: 1.2,
                    }}
                  >
                    {selectedCoupon.code}
                  </Text>
                </View>

                {/* Close Link */}
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={{
                    backgroundColor: "#2563EB",
                    paddingVertical: RFValue(12),
                    borderRadius: RFValue(8),
                    marginBottom: RFValue(12),
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: RFValue(15),
                      color: "#f7f8f9ff",
                      fontWeight: "700",
                      letterSpacing: 1,
                    }}
                  >
                    CLOSE
                  </Text>
                </Pressable>
              </SafeAreaView>
            </View>
          </Modal>
        )}
      </View>
    </SafeAreaView>
  );
}

/*-----------------------------------------------------------------------------------------------------*/
/*                                            StyleSheet                                               */
/*-----------------------------------------------------------------------------------------------------*/
const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(192, 217, 228, 0.28)",
    borderRadius: RFValue(14),
    marginHorizontal: RFValue(16),
    marginVertical: 8,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  revealContainer: {
    backgroundColor: "#2A4365",
    borderRadius: RFValue(14),
    padding: RFValue(24),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  heading: {
    fontSize: RFValue(18),
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: RFValue(6),
    letterSpacing: 0.5,
  },
  subtext: {
    fontSize: RFValue(13),
    color: "#CBD5E1",
    marginBottom: RFValue(16),
  },
  divider: {
    width: "70%",
    height: 1,
    backgroundColor: "#A0AEC0",
    marginBottom: RFValue(16),
  },
  revealButton: {
    backgroundColor: "#ECC94B",
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(28),
    borderRadius: RFValue(8),
    shadowColor: "#805D0A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  viewDetailsButton: {
    paddingHorizontal: RFValue(8),
    borderRadius: RFValue(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  viewDetailsText: {
    color: "#1E3A8A",
    fontWeight: "600",
    fontSize: RFValue(12),
    letterSpacing: 0.8,
    textAlign: "center",
    padding: RFValue(4),
  },
  revealText: {
    color: "#2A4365",
    fontWeight: "700",
    fontSize: RFValue(13),
    letterSpacing: 1.2,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: RFValue(8),
  },

  title: {
    fontSize: RFValue(18),
    fontWeight: "700",
    color: "#1E293B",
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  validity: {
    fontSize: RFValue(12),
    fontWeight: "600",
    paddingHorizontal: RFValue(8),
    paddingVertical: RFValue(2),
    borderRadius: RFValue(6),
    alignSelf: "center",
  },

  description: {
    fontSize: RFValue(13),
    color: "#4A5568",
    marginTop: RFValue(3),
    lineHeight: RFValue(15),
    marginBottom: RFValue(3),
  },

  minOrder: {
    fontSize: RFValue(12),
    color: "#434445ff",
    marginTop: RFValue(2),
  },

  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: RFValue(12),
    paddingHorizontal: RFValue(16),
    backgroundColor: "#2A4365",
    borderTopWidth: 0.5,
    borderColor: "#E2E8F0",
  },

  code: {
    fontSize: RFValue(15),
    fontWeight: "700",
    color: "#ECC94B",
    letterSpacing: 1.5,
  },

  copyButton: {
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(14),
    backgroundColor: "#ECC94B",
    borderRadius: RFValue(6),
  },

  copyText: {
    color: "#2A4365",
    fontWeight: "700",
    fontSize: RFValue(12),
    letterSpacing: 0.5,
  },

  /*  Loader */
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc0a",
  },
  text: {
    marginTop: RFValue(15),
    fontSize: RFValue(16),
    color: "#1E293B",
    fontWeight: "500",
  },
});
