import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform,
  StatusBar, Animated, Modal, TouchableWithoutFeedback, TextInput, Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodCart } from '@/context/FoodCartContext';
import firestore from '@react-native-firebase/firestore';
import {
  getMenuByRestaurant,
  getAddonsByRestaurant,
  getOffersByRestaurant,
  getRestaurantById,
  type MenuItem,
  type MenuAddon,
  type FoodCategory as Category,
  type RestaurantOffer,
  type Restaurant,
} from '@/firebase/foodFirebase';

const { width } = Dimensions.get('window');
const GREEN = '#3d9b6e';
const GRAY  = '#686b78';
const LIGHT = '#f0f0f5';

export default function RestaurantDetailScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();
  const {
    restaurantId, restaurantName, restaurantImage,
    rating, deliveryTime, avgPrice, freeDelivery,
    cuisineType, address, openingTime, closingTime,
    profileImage, coverImage, description,
  } = route.params ?? {};

  // Debug: Log received params
  console.log('[RestaurantDetail] Route params:', {
    restaurantId,
    restaurantName,
    profileImage,
    coverImage,
    restaurantImage,
    description,
  });

  const { addItem, removeItem, getItemQty, totalItems, totalPrice } = useFoodCart();

  const [menuItems,     setMenuItems]     = useState<MenuItem[]>([]);
  const [offers,        setOffers]        = useState<RestaurantOffer[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [restaurant,    setRestaurant]    = useState<Restaurant | null>(null);
  const [restaurantRating, setRestaurantRating] = useState<{ avgRating: number; totalReviews: number } | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [activeCategory,setActiveCategory]= useState<string>('');
  const [showMenuDrawer,   setShowMenuDrawer]   = useState(false);
  const [offersExpanded,   setOffersExpanded]   = useState(false);
  const [activeFilter,     setActiveFilter]     = useState<string | null>(null);
  const [showSchedule,     setShowSchedule]     = useState(false);
  const [scheduledTime,    setScheduledTime]    = useState<string | null>(null);
  const [showSearch,       setShowSearch]       = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [showMoreSheet,    setShowMoreSheet]    = useState(false);
  const [descExpanded,     setDescExpanded]     = useState(false);
  const [itemSheet,        setItemSheet]        = useState<{
    visible: boolean; item: MenuItem | null; qty: number; cookingNote: string;
  }>({ visible: false, item: null, qty: 1, cookingNote: '' });
  const [lastAddedItem,    setLastAddedItem]    = useState<MenuItem | null>(null);
  const [suggestions,      setSuggestions]      = useState<MenuItem[]>([]);
  const itemSheetAnim = useRef(new Animated.Value(0)).current;
  const scheduleAnim   = useRef(new Animated.Value(0)).current;
  const searchAnim     = useRef(new Animated.Value(0)).current;
  const moreSheetAnim  = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<any>(null);

  const sectionRefs = useRef<{ [key: string]: number }>({});
  const scrollRef   = useRef<ScrollView>(null);
  const drawerAnim  = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [items, , offerItems, restData] = await Promise.all([
        getMenuByRestaurant(restaurantId),
        getAddonsByRestaurant(restaurantId),
        getOffersByRestaurant(restaurantId),
        getRestaurantById(restaurantId),
      ]);
      setMenuItems(items);
      setOffers(offerItems);
      if (restData) {
        setRestaurant(restData);
        console.log('[RestaurantDetail] Fetched restaurant data:', {
          id: restData.id,
          name: restData.restaurantName,
          profileImage: restData.profileImage,
          coverImage: restData.coverImage,
          image: restData.image,
        });
      }

      // Fetch reviews and calculate average rating
      const reviewsSnap = await firestore()
        .collection('restaurant_Reviews')
        .where('restaurantId', '==', restaurantId)
        .get();
      
      if (!reviewsSnap.empty) {
        const ratings = reviewsSnap.docs
          .map(d => d.data().rating)
          .filter(r => typeof r === 'number' && r > 0);
        
        if (ratings.length > 0) {
          const sum = ratings.reduce((acc, r) => acc + r, 0);
          const avg = sum / ratings.length;
          setRestaurantRating({ avgRating: avg, totalReviews: ratings.length });
        }
      }
      const catMap = new Map<string, Category>();
      items.forEach(item => {
        if (item.categoryId && item.category && !catMap.has(item.categoryId))
          catMap.set(item.categoryId, { id: item.categoryId, name: item.category, image: '', isActive: true, companyIds: [] });
      });
      const cats = Array.from(catMap.values());
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0].id);
    } catch (e) {
      console.error('[RestaurantDetail] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const itemsByCategory = (catId: string) => menuItems.filter(i => i.categoryId === catId);

  const openMenuDrawer = () => {
    setShowMenuDrawer(true);
    Animated.spring(drawerAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  };
  const closeMenuDrawer = () => {
    Animated.timing(drawerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setShowMenuDrawer(false)
    );
  };

  const openSchedule = () => {
    setShowSchedule(true);
    Animated.spring(scheduleAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  };
  const closeSchedule = () => {
    Animated.timing(scheduleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setShowSchedule(false)
    );
  };

  const openSearch = () => {
    setShowSearch(true);
    setSearchQuery('');
    Animated.timing(searchAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => {
      searchInputRef.current?.focus();
    });
  };
  const closeSearch = () => {
    Animated.timing(searchAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setShowSearch(false);
      setSearchQuery('');
    });
  };

  const openMoreSheet = () => {
    setShowMoreSheet(true);
    Animated.spring(moreSheetAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  };
  const closeMoreSheet = () => {
    Animated.timing(moreSheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setShowMoreSheet(false)
    );
  };

  const openItemSheet = (item: MenuItem) => {
    setItemSheet({ visible: true, item, qty: 1, cookingNote: '' });
    Animated.spring(itemSheetAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  };
  const closeItemSheet = () => {
    Animated.timing(itemSheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setItemSheet({ visible: false, item: null, qty: 1, cookingNote: '' })
    );
  };

  // Fetch suggestions from restaurant_suggestions for a given item
  const fetchSuggestions = async (itemId: string) => {
    try {
      const snap = await firestore()
        .collection('restaurant_suggestions')
        .where('restaurantId', '==', restaurantId)
        .limit(1)
        .get();
      if (snap.empty) { setSuggestions([]); return; }
      const data = snap.docs[0].data();
      const suggestionsMap: Record<string, string[]> = data.suggestionsMap ?? {};
      const suggestedIds: string[] = suggestionsMap[itemId] ?? [];
      if (suggestedIds.length === 0) { setSuggestions([]); return; }
      // Find matching items from already-loaded menuItems
      const matched = menuItems.filter(m => suggestedIds.includes(m.id)).slice(0, 5);
      setSuggestions(matched);
    } catch (e) {
      setSuggestions([]);
    }
  };

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  }, [searchQuery, menuItems]);

  // Generate time slots: next 2 hours in 30-min increments
  const timeSlots = React.useMemo(() => {
    const slots: string[] = [];
    const now = new Date();
    // Round up to next 30-min slot
    const start = new Date(now);
    start.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
    for (let i = 0; i < 8; i++) {
      const t = new Date(start.getTime() + i * 30 * 60 * 1000);
      const h = t.getHours();
      const m = t.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      slots.push(`${displayH}:${m.toString().padStart(2, '0')} ${ampm}`);
    }
    return slots;
  }, []);

  // Filter chips logic
  const FILTER_CHIPS = [
    { id: 'reordered', label: 'Highly reordered' },
    { id: 'spicy',     label: 'Spicy' },
    { id: 'bestseller',label: 'Bestseller' },
  ];

  const applyFilter = (items: MenuItem[]) => {
    if (!activeFilter) return items;
    switch (activeFilter) {
      case 'reordered':
        // Items with high order count or marked as popular
        return items.filter(i => (i as any).isPopular === true || (i as any).orderCount > 10);
      case 'spicy':
        return items.filter(i =>
          (i as any).isSpicy === true ||
          (i.name || '').toLowerCase().includes('spicy') ||
          (i.description || '').toLowerCase().includes('spicy')
        );
      case 'bestseller':
        return items.filter(i =>
          (i as any).isBestseller === true ||
          (i as any).isPopular === true
        );
      default:
        return items;
    }
  };

  const isPureVeg = (restaurant?.cuisineType ?? cuisineType) === 'veg';
  const displayRating    = restaurant?.rating;
  const displayDelivery  = restaurant?.deliveryTime ?? deliveryTime;
  const displayAddress   = restaurant?.address ?? address;
  const displayFreeDeliv = restaurant?.freeDelivery ?? freeDelivery;
  const displayAvgPrice  = restaurant?.avgPrice ?? avgPrice;
  const displayCoverImage = restaurant?.coverImage ?? coverImage;
  const displayProfileImage = restaurant?.profileImage ?? restaurant?.image ?? profileImage ?? restaurantImage;
  const displayDescription = restaurant?.description ?? description;

  // Debug: Log what will be displayed
  console.log('[RestaurantDetail] Display values:', {
    displayCoverImage,
    displayProfileImage,
    displayDescription,
  });

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#3d3d3d" />
        </TouchableOpacity>
        <TouchableOpacity style={s.searchBtn} activeOpacity={0.7} onPress={openSearch}>
          <Ionicons name="search-outline" size={18} color="#3d3d3d" />
          <Text style={s.searchTxt}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.moreBtn} activeOpacity={0.7} onPress={openMoreSheet}>
          <Ionicons name="ellipsis-vertical" size={20} color="#3d3d3d" />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── Cover Image Banner ── */}
        {displayCoverImage && (
          <View style={s.coverImageWrap}>
            <Image 
              source={{ uri: displayCoverImage }} 
              style={s.coverImage} 
              contentFit="cover" 
            />
            <View style={s.coverOverlay} />
          </View>
        )}

        {/* ── Restaurant Info Card ── */}
        <View style={[s.infoCard, displayCoverImage && s.infoCardWithCover]}>
          {/* Profile Image in Top Right Corner */}
          {displayProfileImage && (
            <View style={s.profileImageCorner}>
              <Image 
                source={{ uri: displayProfileImage }} 
                style={s.profileImageInCorner} 
                contentFit="cover" 
              />
            </View>
          )}
          
          {isPureVeg && (
            <View style={s.pureVegBadge}>
              <Ionicons name="leaf" size={11} color={GREEN} />
              <Text style={s.pureVegTxt}>Pure Veg</Text>
            </View>
          )}

          <View style={s.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.restName}>{restaurantName}</Text>
              
              {/* Restaurant Description */}
              {displayDescription && (
                <View style={s.descSection}>
                  <Text 
                    style={s.restDescription} 
                    numberOfLines={descExpanded ? undefined : 2}
                  >
                    {displayDescription}
                  </Text>
                  {displayDescription.length > 80 && (
                    <TouchableOpacity 
                      onPress={() => setDescExpanded(!descExpanded)} 
                      activeOpacity={0.7}
                      style={s.seeMoreBtn}
                    >
                      <Text style={s.seeMoreTxt}>
                        {descExpanded ? 'See less' : 'See more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              <View style={s.metaRow}>
                <Ionicons name="location-outline" size={13} color={GRAY} />
                <Text style={s.metaTxt} numberOfLines={1}>{displayAddress || '1 km · Nearby'}</Text>
              </View>
              <View style={s.metaRow}>
                <Ionicons name="flash" size={13} color={GREEN} />
                <Text style={s.metaTxt}>
                  {displayDelivery ? `${displayDelivery} mins` : '30–40 mins'}
                </Text>
                <Text style={s.metaDot}>·</Text>
                <TouchableOpacity onPress={openSchedule} activeOpacity={0.7} style={s.scheduleBtn}>
                  <Text style={s.scheduleTxt}>
                    {scheduledTime ? `Scheduled: ${scheduledTime}` : 'Schedule for later'}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={GREEN} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Rating Box — real data from restaurant_Reviews */}
            {restaurantRating != null && (
              <View style={s.ratingBox}>
                <View style={s.ratingTop}>
                  <Text style={s.ratingNum}>{restaurantRating.avgRating.toFixed(1)}</Text>
                  <Ionicons name="star" size={12} color="#fff" />
                </View>
                <Text style={s.ratingCount}>
                  {restaurantRating.totalReviews >= 1000
                    ? `${(restaurantRating.totalReviews / 1000).toFixed(1)}K+ ratings`
                    : `${restaurantRating.totalReviews} ratings`}
                </Text>
              </View>
            )}
          </View>

          {/* Info chips */}
          <View style={s.chipsRow}>
            <View style={s.chip}>
              <Ionicons name="checkmark" size={12} color={GREEN} />
              <Text style={s.chipTxt}>No packaging charges</Text>
            </View>
            {(displayFreeDeliv || !displayAvgPrice) && (
              <View style={s.chip}>
                <Ionicons name="checkmark" size={12} color={GREEN} />
                <Text style={s.chipTxt}>Free delivery</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Offers Strip ── */}
        {offers.length > 0 && (
          <View style={s.offersSection}>
            <TouchableOpacity
              style={s.offerRow}
              activeOpacity={0.8}
              onPress={() => setOffersExpanded(p => !p)}
            >
              <View style={s.offerIconWrap}>
                <MaterialIcons name="local-offer" size={16} color="#fff" />
              </View>
              <Text style={s.offerMainTxt} numberOfLines={1}>
                {offers[0].discountPercentage}% OFF on selected items
              </Text>
              <Text style={s.offerCount}>{offers.length} offers</Text>
              <Ionicons name={offersExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={GRAY} />
            </TouchableOpacity>
            {offersExpanded && offers.map(o => (
              <View key={o.id} style={s.offerExpandRow}>
                <View style={s.offerExpandDot} />
                <Text style={s.offerExpandTxt}>
                  {o.discountPercentage}% OFF on {o.menuItemName} — ₹{o.discountedPrice} instead of ₹{o.originalPrice}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.divider} />

        {/* ── Filter Chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterList}>
          <TouchableOpacity
            style={[s.filterChip, !!activeFilter && s.filterChipActive]}
            activeOpacity={0.75}
            onPress={() => setActiveFilter(null)}
          >
            <Ionicons name="options-outline" size={13} color={activeFilter ? '#fff' : '#3d3d3d'} />
            <Text style={[s.filterChipTxt, !!activeFilter && s.filterChipTxtActive]}>Filters</Text>
            {activeFilter && <Ionicons name="close" size={12} color="#fff" />}
          </TouchableOpacity>
          {FILTER_CHIPS.map(f => {
            const active = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[s.filterChip, active && s.filterChipActive]}
                activeOpacity={0.75}
                onPress={() => setActiveFilter(active ? null : f.id)}
              >
                <Text style={[s.filterChipTxt, active && s.filterChipTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.divider} />

        {/* ── Menu Sections ── */}
        {categories.map(cat => {
          const items = applyFilter(itemsByCategory(cat.id));
          if (items.length === 0) return null;
          return (
            <View
              key={cat.id}
              onLayout={e => { sectionRefs.current[cat.id] = e.nativeEvent.layout.y; }}
            >
              {/* Category Header */}
              <TouchableOpacity
                style={s.catHeader}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(activeCategory === cat.id ? '' : cat.id)}
              >
                <Text style={s.catHeaderTxt}>{cat.name}</Text>
                <View style={s.catHeaderRight}>
                  <Text style={s.catCount}>{items.length}</Text>
                  <Ionicons
                    name={activeCategory === cat.id ? 'chevron-up' : 'chevron-down'}
                    size={16} color="#3d3d3d"
                  />
                </View>
              </TouchableOpacity>

              {/* Items */}
              {items.map((item, idx) => {
                const qty   = getItemQty(item.id);
                const offer = offers.find(o =>
                  o.menuItemId === item.id ||
                  o.menuItemName?.toLowerCase().trim() === item.name?.toLowerCase().trim()
                );
                const isVeg    = (item.foodType || '').toLowerCase() === 'veg';
                const isNonVeg = (item.foodType || '').toLowerCase().includes('nonveg') ||
                                 (item.foodType || '').toLowerCase().includes('non-veg');
                const dotColor = isVeg ? GREEN : isNonVeg ? '#c0392b' : GREEN;

                return (
                  <View key={item.id} style={[s.menuItem, idx < items.length - 1 && s.menuItemBorder]}>

                    {/* ── Left: tap = open sheet ── */}
                    <Pressable
                      style={s.menuLeft}
                      onPress={() => openItemSheet(item)}
                    >
                      <View style={[s.vegSquare, { borderColor: dotColor }]}>
                        <View style={[s.vegSquareInner, { backgroundColor: dotColor }]} />
                      </View>
                      <Text style={s.itemName}>{item.name}</Text>
                      {offer ? (
                        <View style={s.priceRow}>
                          <Text style={s.priceDiscounted}>₹{offer.discountedPrice}</Text>
                          <Text style={s.priceOriginal}>₹{offer.originalPrice}</Text>
                        </View>
                      ) : (
                        <Text style={s.itemPrice}>₹{item.price}</Text>
                      )}
                      <View style={s.reorderRow}>
                        <View style={s.reorderBar} />
                        <Text style={s.reorderTxt}>Highly reordered</Text>
                      </View>
                      {item.description ? (
                        <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                      <View style={s.itemActions}>
                        <View style={s.iconBtn}>
                          <Ionicons name="bookmark-outline" size={16} color={GRAY} />
                        </View>
                        <View style={s.iconBtn}>
                          <Ionicons name="share-social-outline" size={16} color={GRAY} />
                        </View>
                      </View>
                    </Pressable>

                    {/* ── Right: image + ADD — completely isolated ── */}
                    <View style={s.menuRight}>
                      {/* Image tap → open sheet */}
                      <Pressable onPress={() => openItemSheet(item)}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                        ) : (
                          <View style={[s.itemImg, s.itemImgPlaceholder]}>
                            <Ionicons name="fast-food-outline" size={28} color="#ccc" />
                          </View>
                        )}
                      </Pressable>

                      {/* ADD button — direct add only, no modal */}
                      {qty === 0 ? (
                        <Pressable
                          style={s.addBtn}
                          onPress={() => {
                            if (!item.variants || item.variants.length === 0) {
                              addItem({
                                id: item.id,
                                name: item.name,
                                price: offer ? offer.discountedPrice : Number(item.price),
                                image: item.image,
                                restaurantId,
                                restaurantName,
                                description: item.description,
                              });
                              setLastAddedItem(item);
                              fetchSuggestions(item.id);
                            } else {
                              openItemSheet(item);
                            }
                          }}
                        >
                          <Text style={s.addBtnTxt}>ADD</Text>
                          {item.variants?.length > 0 && <Text style={s.addBtnPlus}>+</Text>}
                        </Pressable>
                      ) : (
                        <View style={s.qtyControl}>
                          <Pressable style={s.qtyBtn} onPress={() => removeItem(item.id)}>
                            <Ionicons name="remove" size={15} color={GREEN} />
                          </Pressable>
                          <Text style={s.qtyTxt}>{qty}</Text>
                          <Pressable
                            style={s.qtyBtn}
                            onPress={() => {
                              if (!item.variants || item.variants.length === 0) {
                                addItem({
                                  id: item.id,
                                  name: item.name,
                                  price: offer ? offer.discountedPrice : Number(item.price),
                                  image: item.image,
                                  restaurantId,
                                  restaurantName,
                                  description: item.description,
                                });
                              } else {
                                openItemSheet(item);
                              }
                            }}
                          >
                            <Ionicons name="add" size={15} color={GREEN} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}

              <View style={s.sectionDivider} />
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── "You'll love pairing it with" suggestions ── */}
      {lastAddedItem != null && suggestions.length > 0 && (
        <View style={[s.suggestionsBar, { bottom: totalItems > 0 ? insets.bottom + 76 : insets.bottom + 12 }]}>
          <View style={s.suggestionsHeader}>
            <Text style={s.suggestionsTitleSmall}>You'll love pairing it with</Text>
            <TouchableOpacity onPress={() => { setLastAddedItem(null); setSuggestions([]); }} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color={GRAY} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestionsList}>
            {suggestions.map(sug => {
              const sugOffer = offers.find(o =>
                o.menuItemId === sug.id ||
                o.menuItemName?.toLowerCase().trim() === sug.name?.toLowerCase().trim()
              );
              const sugPrice = sugOffer ? sugOffer.discountedPrice : Number(sug.price);
              return (
                <TouchableOpacity
                  key={sug.id}
                  style={s.suggestionCard}
                  activeOpacity={0.85}
                  onPress={() => openItemSheet(sug)}
                >
                  {sug.image
                    ? <Image source={{ uri: sug.image }} style={s.suggestionImg} contentFit="cover" />
                    : <View style={[s.suggestionImg, s.suggestionImgPlaceholder]}>
                        <Ionicons name="fast-food-outline" size={20} color="#ccc" />
                      </View>
                  }
                  <Text style={s.suggestionName} numberOfLines={2}>{sug.name}</Text>
                  <Text style={s.suggestionPrice}>₹{sugPrice}</Text>
                  <TouchableOpacity
                    style={s.suggestionAddBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      addItem({
                        id: sug.id, name: sug.name, price: sugPrice,
                        image: sug.image, restaurantId, restaurantName,
                        description: sug.description,
                      });
                    }}
                  >
                    <Text style={s.suggestionAddTxt}>ADD</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Cart Bar ── */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={[s.cartBar, { bottom: insets.bottom + 12 }]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('FoodCartTab')}
        >
          <View style={s.cartBarLeft}>
            <View style={s.cartCount}>
              <Text style={s.cartCountTxt}>{totalItems}</Text>
            </View>
            <Text style={s.cartBarTxt}>View Cart</Text>
          </View>
          <Text style={s.cartBarPrice}>₹{totalPrice}</Text>
        </TouchableOpacity>
      )}

      {/* ── Floating Menu FAB (bottom-right, Swiggy style) ── */}
      {categories.length > 0 && (
        <TouchableOpacity
          style={[s.menuFab, { bottom: (totalItems > 0 ? insets.bottom + 72 : insets.bottom + 20) }]}
          onPress={openMenuDrawer}
          activeOpacity={0.85}
        >
          <Ionicons name="book-outline" size={16} color="#fff" />
          <Text style={s.menuFabTxt}>Menu</Text>
        </TouchableOpacity>
      )}

      {/* ── Menu Drawer ── */}
      <Modal visible={showMenuDrawer} transparent animationType="none" statusBarTranslucent onRequestClose={closeMenuDrawer}>
        <TouchableWithoutFeedback onPress={closeMenuDrawer}>
          <Animated.View style={[s.drawerOverlay, { opacity: drawerAnim }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.drawerSheet, {
          transform: [{ translateY: drawerAnim.interpolate({ inputRange: [0,1], outputRange: [500, 0] }) }],
        }]}>
          <View style={s.drawerHandle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {categories.map((cat, i) => {
              const count = menuItems.filter(x => x.categoryId === cat.id).length;
              const isFirst = i === 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.menuDrawerItem, i < categories.length - 1 && s.menuDrawerItemBorder]}
                  activeOpacity={0.75}
                  onPress={() => {
                    setActiveCategory(cat.id);
                    const y = sectionRefs.current[cat.id];
                    if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
                    closeMenuDrawer();
                  }}
                >
                  <Text style={[s.menuDrawerName, isFirst && s.menuDrawerNameFirst]}>{cat.name}</Text>
                  <Text style={[s.menuDrawerCount, isFirst && s.menuDrawerCountFirst]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity style={s.menuCloseBtn} onPress={closeMenuDrawer} activeOpacity={0.85}>
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={s.menuCloseTxt}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* ── Search Screen ── */}
      <Modal visible={showSearch} transparent animationType="none" statusBarTranslucent onRequestClose={closeSearch}>
        <Animated.View style={[s.searchScreen, { opacity: searchAnim, paddingTop: insets.top }]}>
          {/* Search Header */}
          <View style={s.searchHeader}>
            <TouchableOpacity onPress={closeSearch} style={s.searchBackBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={22} color="#282c3f" />
            </TouchableOpacity>
            <View style={s.searchInputWrap}>
              <Ionicons name="search-outline" size={17} color="#93959f" />
              <TextInput
                ref={searchInputRef}
                style={s.searchInput}
                placeholder={`Search in ${restaurantName}`}
                placeholderTextColor="#93959f"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={18} color="#93959f" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Results Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.searchGrid}
            keyboardShouldPersistTaps="handled"
          >
            {searchResults.length === 0 ? (
              <View style={s.searchEmpty}>
                <Text style={{ fontSize: 40 }}>🔍</Text>
                <Text style={s.searchEmptyTitle}>No results found</Text>
                <Text style={s.searchEmptySubtitle}>Try a different dish name</Text>
              </View>
            ) : (
              (() => {
                // Masonry-style: alternate large + small tiles like Swiggy
                const tiles: React.ReactElement[] = [];
                let i = 0;
                while (i < searchResults.length) {
                  const item = searchResults[i];
                  const next = searchResults[i + 1];
                  const isLarge = i % 5 === 2; // every 3rd item in a group of 5 is large

                  if (isLarge || !next) {
                    // Full-width large tile
                    tiles.push(
                      <TouchableOpacity
                        key={item.id}
                        style={s.tileWide}
                        activeOpacity={0.88}
                        onPress={() => { closeSearch(); openItemSheet(item); }}
                      >
                        {item.image
                          ? <Image source={{ uri: item.image }} style={s.tileWideImg} contentFit="cover" />
                          : <View style={[s.tileWideImg, s.tilePlaceholder]}><Ionicons name="fast-food-outline" size={36} color="#ccc" /></View>
                        }
                        <View style={s.tileLabel}>
                          <View style={[s.tileDot, { borderColor: (item.foodType || '').toLowerCase() === 'veg' ? GREEN : '#c0392b' }]}>
                            <View style={[s.tileDotInner, { backgroundColor: (item.foodType || '').toLowerCase() === 'veg' ? GREEN : '#c0392b' }]} />
                          </View>
                          <Text style={s.tileName} numberOfLines={1}>{item.name}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                    i += 1;
                  } else {
                    // Two small tiles side by side
                    tiles.push(
                      <View key={`row-${i}`} style={s.tileRow}>
                        {[item, next].map(it => (
                          <TouchableOpacity
                            key={it.id}
                            style={s.tileSmall}
                            activeOpacity={0.88}
                            onPress={() => { closeSearch(); openItemSheet(it); }}
                          >
                            {it.image
                              ? <Image source={{ uri: it.image }} style={s.tileSmallImg} contentFit="cover" />
                              : <View style={[s.tileSmallImg, s.tilePlaceholder]}><Ionicons name="fast-food-outline" size={24} color="#ccc" /></View>
                            }
                            <View style={s.tileLabel}>
                              <View style={[s.tileDot, { borderColor: (it.foodType || '').toLowerCase() === 'veg' ? GREEN : '#c0392b' }]}>
                                <View style={[s.tileDotInner, { backgroundColor: (it.foodType || '').toLowerCase() === 'veg' ? GREEN : '#c0392b' }]} />
                              </View>
                              <Text style={s.tileName} numberOfLines={1}>{it.name}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                    i += 2;
                  }
                }
                return tiles;
              })()
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* ── More Options Sheet ── */}
      <Modal visible={showMoreSheet} transparent animationType="none" statusBarTranslucent onRequestClose={closeMoreSheet}>
        <TouchableWithoutFeedback onPress={closeMoreSheet}>
          <Animated.View style={[s.drawerOverlay, { opacity: moreSheetAnim }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.moreSheet, {
          transform: [{ translateY: moreSheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
        }]}>
          <View style={s.drawerHandle} />
          <Text style={s.moreSheetTitle}>{restaurantName}</Text>
          {[
            { icon: 'bookmark-outline',           label: 'Add to Collection' },
            { icon: 'people-outline',             label: 'Group Order' },
            { icon: 'information-circle-outline', label: 'See more about this restaurant' },
            { icon: 'share-outline',              label: 'Share this restaurant' },
            { icon: 'eye-off-outline',            label: 'Hide this restaurant' },
            { icon: 'flag-outline',               label: 'Report fraud or bad practices' },
          ].map((opt, i, arr) => (
            <TouchableOpacity
              key={opt.label}
              style={[s.moreOption, i < arr.length - 1 && s.moreOptionBorder]}
              activeOpacity={0.7}
              onPress={closeMoreSheet}
            >
              <Ionicons name={opt.icon as any} size={22} color="#282c3f" />
              <Text style={s.moreOptionTxt}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <Text style={s.moreFooter}>
            Menu items, photos and descriptions are set directly by the restaurant. In case you see any incorrect information, please report it to us.
          </Text>
          <View style={{ height: Platform.OS === 'ios' ? 34 : 16 }} />
        </Animated.View>
      </Modal>

      {/* ── Schedule for Later Modal ── */}
      <Modal visible={showSchedule} transparent animationType="none" statusBarTranslucent onRequestClose={closeSchedule}>
        <TouchableWithoutFeedback onPress={closeSchedule}>
          <Animated.View style={[s.drawerOverlay, { opacity: scheduleAnim }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.drawerSheet, {
          transform: [{ translateY: scheduleAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
        }]}>
          <View style={s.drawerHandle} />
          <View style={s.scheduleHeader}>
            <Text style={s.drawerTitle}>Schedule Delivery</Text>
            {scheduledTime && (
              <TouchableOpacity onPress={() => { setScheduledTime(null); closeSchedule(); }} activeOpacity={0.7}>
                <Text style={s.scheduleClear}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.scheduleSubtitle}>Choose a delivery time slot</Text>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={s.slotGrid}>
              {timeSlots.map(slot => {
                const selected = scheduledTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[s.slotBtn, selected && s.slotBtnActive]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setScheduledTime(slot);
                      closeSchedule();
                    }}
                  >
                    <Ionicons name="time-outline" size={14} color={selected ? '#fff' : GREEN} />
                    <Text style={[s.slotTxt, selected && s.slotTxtActive]}>{slot}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* ── Item Detail Sheet ── */}
      <Modal
        visible={itemSheet.visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeItemSheet}
      >
        <TouchableWithoutFeedback onPress={closeItemSheet}>
          <Animated.View style={[s.drawerOverlay, { opacity: itemSheetAnim }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.itemSheetContainer, {
          transform: [{ translateY: itemSheetAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }) }],
        }]}>
          {itemSheet.item && (() => {
            const item = itemSheet.item!;
            const offer = offers.find(o =>
              o.menuItemId === item.id ||
              o.menuItemName?.toLowerCase().trim() === item.name?.toLowerCase().trim()
            );
            const isVeg    = (item.foodType || '').toLowerCase() === 'veg';
            const isNonVeg = (item.foodType || '').toLowerCase().includes('nonveg') ||
                             (item.foodType || '').toLowerCase().includes('non-veg');
            const dotColor = isVeg ? GREEN : isNonVeg ? '#c0392b' : GREEN;
            const price    = offer ? offer.discountedPrice : Number(item.price);
            const total    = price * itemSheet.qty;

            return (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Item Image */}
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.itemSheetImg} contentFit="cover" />
                ) : (
                  <View style={[s.itemSheetImg, s.itemSheetImgPlaceholder]}>
                    <Ionicons name="fast-food-outline" size={48} color="#ccc" />
                  </View>
                )}

                <View style={s.itemSheetBody}>
                  {/* Veg dot + Spicy */}
                  <View style={s.itemSheetDotRow}>
                    <View style={[s.vegSquare, { borderColor: dotColor }]}>
                      <View style={[s.vegSquareInner, { backgroundColor: dotColor }]} />
                    </View>
                  </View>

                  {/* Name + actions */}
                  <View style={s.itemSheetNameRow}>
                    <Text style={s.itemSheetName}>{item.name}</Text>
                    <View style={s.itemSheetActions}>
                      <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
                        <Ionicons name="bookmark-outline" size={16} color={GRAY} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
                        <Ionicons name="share-social-outline" size={16} color={GRAY} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Highly reordered */}
                  <View style={s.reorderRow}>
                    <View style={s.reorderBar} />
                    <Text style={s.reorderTxt}>Highly reordered</Text>
                  </View>

                  {/* Description */}
                  {item.description ? (
                    <Text style={s.itemSheetDesc}>{item.description}</Text>
                  ) : null}

                  {/* Cooking request */}
                  <View style={s.cookingSection}>
                    <View style={s.cookingHeader}>
                      <Text style={s.cookingTitle}>Add a cooking request (optional)</Text>
                      <Ionicons name="information-circle-outline" size={16} color={GRAY} />
                    </View>
                    <TextInput
                      style={s.cookingInput}
                      placeholder="e.g. Don't make it too spicy"
                      placeholderTextColor="#b0b0b0"
                      value={itemSheet.cookingNote}
                      onChangeText={t => setItemSheet(p => ({ ...p, cookingNote: t }))}
                      multiline
                      maxLength={100}
                    />
                    <Text style={s.cookingCount}>{itemSheet.cookingNote.length}/100</Text>
                  </View>

                  <View style={{ height: 100 }} />
                </View>
              </ScrollView>
            );
          })()}

          {/* Bottom bar: qty + Add item */}
          {itemSheet.item && (() => {
            const item = itemSheet.item!;
            const offer = offers.find(o =>
              o.menuItemId === item.id ||
              o.menuItemName?.toLowerCase().trim() === item.name?.toLowerCase().trim()
            );
            const price = offer ? offer.discountedPrice : Number(item.price);
            const total = price * itemSheet.qty;

            return (
              <View style={[s.itemSheetBar, { paddingBottom: insets.bottom + 12 }]}>
                {/* Qty control */}
                <View style={s.itemSheetQty}>
                  <TouchableOpacity
                    style={s.itemSheetQtyBtn}
                    activeOpacity={0.8}
                    onPress={() => setItemSheet(p => ({ ...p, qty: Math.max(1, p.qty - 1) }))}
                  >
                    <Ionicons name="remove" size={18} color={GREEN} />
                  </TouchableOpacity>
                  <Text style={s.itemSheetQtyTxt}>{itemSheet.qty}</Text>
                  <TouchableOpacity
                    style={s.itemSheetQtyBtn}
                    activeOpacity={0.8}
                    onPress={() => setItemSheet(p => ({ ...p, qty: p.qty + 1 }))}
                  >
                    <Ionicons name="add" size={18} color={GREEN} />
                  </TouchableOpacity>
                </View>

                {/* Add item button */}
                <TouchableOpacity
                  style={s.itemSheetAddBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    for (let i = 0; i < itemSheet.qty; i++) {
                      addItem({
                        id: item.id,
                        name: item.name,
                        price,
                        image: item.image,
                        restaurantId,
                        restaurantName,
                        description: item.description,
                      });
                    }
                    closeItemSheet();
                  }}
                >
                  <Text style={s.itemSheetAddTxt}>Add item  ₹{total}</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </Animated.View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  loader:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  // ── Cover Image ──
  coverImageWrap: { 
    width: '100%', 
    height: 200, 
    position: 'relative',
  },
  coverImage: { 
    width: '100%', 
    height: 200,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  
  // ── Profile Image in Corner ──
  profileImageCorner: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f0f0f5',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  profileImageInCorner: {
    width: '100%',
    height: '100%',
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f5',
  },
  backBtn:   { padding: 6 },
  searchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 10, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1, borderColor: '#e8e8e8',
  },
  searchTxt: { fontSize: 14, color: '#686b78' },
  moreBtn:   { padding: 6 },

  // ── Info Card ──
  infoCard: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', position: 'relative' },
  infoCardWithCover: { paddingTop: 16 },
  pureVegBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 8, alignSelf: 'flex-start',
    backgroundColor: '#edfaf3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    marginLeft: 96,
  },
  pureVegTxt: { fontSize: 11, fontWeight: '700', color: '#3d9b6e' },
  infoRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 96 },
  restName:   { fontSize: 22, fontWeight: '800', color: '#282c3f', marginBottom: 6 },
  descSection: { marginBottom: 8 },
  restDescription: { fontSize: 13, color: '#686b78', lineHeight: 18 },
  seeMoreBtn: { marginTop: 4 },
  seeMoreTxt: { fontSize: 13, color: GREEN, fontWeight: '600' },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaTxt:    { fontSize: 13, color: '#686b78' },
  metaDot:    { fontSize: 13, color: '#686b78' },
  scheduleBtn:{ flexDirection: 'row', alignItems: 'center', gap: 2 },
  scheduleTxt:{ fontSize: 13, color: '#3d9b6e', fontWeight: '600' },

  ratingBox: {
    backgroundColor: '#3d9b6e', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 64,
  },
  ratingTop:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingNum:   { fontSize: 16, fontWeight: '800', color: '#fff' },
  ratingCount: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipTxt: { fontSize: 12, color: '#282c3f' },

  divider: { height: 8, backgroundColor: '#f0f0f5' },

  // ── Offers ──
  offersSection: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 },
  offerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fc8019', justifyContent: 'center', alignItems: 'center',
  },
  offerMainTxt:   { flex: 1, fontSize: 13, fontWeight: '600', color: '#282c3f' },
  offerCount:     { fontSize: 12, color: '#3d9b6e', fontWeight: '600' },
  offerExpandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, paddingLeft: 4 },
  offerExpandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3d9b6e', marginTop: 5 },
  offerExpandTxt: { flex: 1, fontSize: 12, color: '#686b78', lineHeight: 18 },

  // ── Filter Chips ──
  filterList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#d4d5d9', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff',
  },
  filterChipTxt: { fontSize: 13, color: '#282c3f', fontWeight: '500' },
  filterChipActive:   { backgroundColor: '#282c3f', borderColor: '#282c3f' },
  filterChipTxtActive:{ color: '#fff', fontWeight: '600' },

  // ── Category Header ──
  catHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
  },
  catHeaderTxt:   { fontSize: 16, fontWeight: '700', color: '#282c3f' },
  catHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catCount:       { fontSize: 13, color: '#686b78' },

  // ── Menu Item ──
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff',
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f5' },
  menuLeft:  { flex: 1, paddingRight: 12 },
  menuRight: { alignItems: 'center', width: 110 },

  vegSquare: {
    width: 16, height: 16, borderRadius: 3, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  vegSquareInner: { width: 8, height: 8, borderRadius: 2 },

  itemName:  { fontSize: 14, fontWeight: '600', color: '#282c3f', marginBottom: 4 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#282c3f', marginBottom: 6 },
  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  priceDiscounted: { fontSize: 14, fontWeight: '700', color: '#282c3f' },
  priceOriginal:   { fontSize: 12, color: '#93959f', textDecorationLine: 'line-through' },

  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reorderBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3d9b6e' },
  reorderTxt: { fontSize: 11, color: '#686b78' },

  itemDesc:    { fontSize: 12, color: '#93959f', lineHeight: 17, marginBottom: 8 },
  itemActions: { flexDirection: 'row', gap: 4, marginTop: 4 },
  iconBtn:     { padding: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e8e8e8' },

  itemImg:            { width: 100, height: 90, borderRadius: 10, marginBottom: 8 },
  itemImgPlaceholder: { backgroundColor: '#f0f0f5', justifyContent: 'center', alignItems: 'center' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#3d9b6e', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 7, backgroundColor: '#fff',
    gap: 2, width: 100,
  },
  addBtnTxt:  { color: '#3d9b6e', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  addBtnPlus: { color: '#3d9b6e', fontSize: 10, fontWeight: '700' },

  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#3d9b6e', borderRadius: 8,
    overflow: 'hidden', width: 100,
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#edfaf3' },
  qtyTxt: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#282c3f' },

  sectionDivider: { height: 8, backgroundColor: '#f0f0f5' },

  // ── Cart Bar ──
  cartBar: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: '#3d9b6e', borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
  },
  cartBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartCount:    { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  cartCountTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cartBarTxt:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartBarPrice: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Menu FAB ──
  menuFab: {
    position: 'absolute', right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#282c3f',
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  menuFabTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Menu Drawer ──
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawerSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '75%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 16,
  },
  drawerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e8e8e8',
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },

  // New clean menu drawer rows
  menuDrawerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 18,
  },
  menuDrawerItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f5' },
  menuDrawerName:       { fontSize: 15, fontWeight: '500', color: '#686b78', flex: 1 },
  menuDrawerNameFirst:  { color: GREEN, fontWeight: '700' },
  menuDrawerCount:      { fontSize: 15, fontWeight: '500', color: '#686b78' },
  menuDrawerCountFirst: { color: GREEN, fontWeight: '700' },

  // Close button inside drawer
  menuCloseBtn: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 36 : 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#282c3f',
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  menuCloseTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Old drawer styles kept for schedule drawer reuse
  drawerTitle:        { fontSize: 16, fontWeight: '800', color: '#282c3f', marginBottom: 10 },
  drawerItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  drawerItemBorder:   { borderBottomWidth: 1, borderBottomColor: '#f0f0f5' },
  drawerDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e8e8e8' },
  drawerDotActive:    { backgroundColor: '#3d9b6e' },
  drawerItemTxt:      { flex: 1, fontSize: 14, fontWeight: '600', color: '#686b78' },
  drawerItemTxtActive:{ color: '#3d9b6e' },
  drawerBadge:        { backgroundColor: '#f0f0f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  drawerBadgeTxt:     { fontSize: 11, fontWeight: '700', color: '#686b78' },

  // ── Search Screen ──
  searchScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 999,
  },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f5',
    gap: 10,
  },
  searchBackBtn: { padding: 4 },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f5f5f5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: '#282c3f', padding: 0,
  },
  searchEmpty: {
    alignItems: 'center', paddingTop: 80, gap: 8,
  },
  searchEmptyTitle:    { fontSize: 17, fontWeight: '700', color: '#282c3f', marginTop: 8 },
  searchEmptySubtitle: { fontSize: 13, color: '#93959f' },

  // Grid tiles
  searchGrid: { padding: 12, gap: 8 },
  tileRow:    { flexDirection: 'row', gap: 8 },

  tileWide: {
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  tileWideImg: { width: '100%', height: 200 },

  tileSmall: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  tileSmallImg: { width: '100%', height: 130 },

  tilePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#ececec' },

  tileLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  tileDot: {
    width: 13, height: 13, borderRadius: 2, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff',
  },
  tileDotInner: { width: 6, height: 6, borderRadius: 1.5 },
  tileName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#fff' },

  // ── Schedule Modal ──
  scheduleHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  scheduleClear:   { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  scheduleSubtitle:{ fontSize: 13, color: '#686b78', marginBottom: 16 },
  slotGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  slotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#3d9b6e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fff', minWidth: '45%',
  },
  slotBtnActive: { backgroundColor: '#3d9b6e', borderColor: '#3d9b6e' },
  slotTxt:       { fontSize: 13, fontWeight: '600', color: '#282c3f' },
  slotTxtActive: { color: '#fff' },

  // ── Item Detail Sheet ──
  itemSheetContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 20,
  },
  itemSheetImg: { width: '100%', height: 240, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  itemSheetImgPlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  itemSheetBody: { paddingHorizontal: 20, paddingTop: 16 },
  itemSheetDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemSheetNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  itemSheetName: { fontSize: 18, fontWeight: '700', color: '#282c3f', flex: 1, marginRight: 12 },
  itemSheetActions: { flexDirection: 'row', gap: 4 },
  itemSheetDesc: { fontSize: 13, color: '#93959f', lineHeight: 20, marginTop: 8 },
  cookingSection: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f0f0f5' },
  cookingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cookingTitle: { fontSize: 14, fontWeight: '600', color: '#282c3f' },
  cookingInput: {
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#282c3f',
    backgroundColor: '#fafafa',
    minHeight: 80, textAlignVertical: 'top',
  },
  cookingCount: { fontSize: 11, color: '#93959f', textAlign: 'right', marginTop: 4 },
  itemSheetBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#f0f0f5',
    backgroundColor: '#fff',
  },
  itemSheetQty: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: GREEN, borderRadius: 10,
    overflow: 'hidden',
  },
  itemSheetQtyBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#edfaf3' },
  itemSheetQtyTxt: { paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: '#282c3f' },
  itemSheetAddBtn: {
    flex: 1, backgroundColor: GREEN, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  itemSheetAddTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── More Options Sheet ──
  moreSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  moreSheetTitle: {
    fontSize: 17, fontWeight: '700', color: '#282c3f',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f5',
    marginBottom: 4,
  },
  moreOption: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
  },
  moreOptionBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  moreOptionTxt: { fontSize: 15, color: '#282c3f', fontWeight: '400' },
  moreFooter: {
    fontSize: 12, color: '#93959f', lineHeight: 18,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f5',
  },

  // ── Suggestions Bar ──
  suggestionsBar: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f5',
    paddingTop: 10, paddingBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
  },
  suggestionsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
  },
  suggestionsTitleSmall: { fontSize: 13, fontWeight: '700', color: '#282c3f' },
  suggestionsList: { paddingHorizontal: 16, gap: 10 },
  suggestionCard: {
    width: 110, backgroundColor: '#fafafa',
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#f0f0f5',
  },
  suggestionImg:            { width: '100%', height: 72 },
  suggestionImgPlaceholder: { backgroundColor: '#f0f0f5', justifyContent: 'center', alignItems: 'center' },
  suggestionName:  { fontSize: 11, fontWeight: '600', color: '#282c3f', paddingHorizontal: 8, paddingTop: 6, lineHeight: 15 },
  suggestionPrice: { fontSize: 11, fontWeight: '700', color: '#282c3f', paddingHorizontal: 8, paddingTop: 2 },
  suggestionAddBtn: {
    margin: 6, borderWidth: 1.5, borderColor: GREEN,
    borderRadius: 6, paddingVertical: 4, alignItems: 'center',
  },
  suggestionAddTxt: { fontSize: 11, fontWeight: '800', color: GREEN },
});
