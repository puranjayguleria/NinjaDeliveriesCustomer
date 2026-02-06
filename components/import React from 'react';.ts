import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ImageBackground, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ValentineSpecialsScreen = () => {
  const navigation = useNavigation<any>();

  // Mock Data for "Best Gifts"
  const bestGifts = [
    {
      id: 1,
      name: "Luxury Chocolate Box",
      price: "24.99",
      image: "https://images.unsplash.com/photo-1549417229-aa67d3263c09?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", 
      bgColor: "#FFF0F5"
    },
    {
      id: 2,
      name: "olu",
      price: "29.99",
      image: "https://images.unsplash.com/photo-1587578851410-66236b280140?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      bgColor: "#FFF0F5"
    },
    {
      id: 3,
      name: "Teddy Bear",
      price: "34.99",
      image: "https://images.unsplash.com/photo-1589136706935-8575086873b0?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      bgColor: "#FFF0F5"
    },
    {
      id: 4,
      name: "Valentine Gift Basket",
      price: "39.99",
      image: "https://images.unsplash.com/photo-1512909006721-3d6018887383?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      bgColor: "#FFF0F5"
    }
  ];

  return (
    <ImageBackground
      source={{ uri: "https://i.pinimg.com/736x/08/90/0d/08900d72023537a6b229780074227783.jpg" }} 
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Valentine Specials</Text>
                <Text style={styles.headerSubtitle}>Surprise Your Loved Ones with Something Sweet</Text>
            </View>

            {/* Sale Banner Card */}
            <View style={styles.bannerCard}>
                <LinearGradient
                    colors={['#FFC1E3', '#F8BBD0', '#F48FB1']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.bannerGradient}
                >
                    <View style={styles.bannerContent}>
                        <View style={styles.bannerLeft}>
                            <Image 
                                source={{ uri: "https://cdn-icons-png.flaticon.com/512/3233/3233772.png" }} 
                                style={styles.bannerImageLeft} 
                            />
                        </View>
                        <View style={styles.bannerCenter}>
                            <Text style={styles.bannerTitle}>Valentine's</Text>
                            <View style={styles.saleBadge}>
                                <Text style={styles.saleText}>SALE</Text>
                            </View>
                            <Text style={styles.discountText}>
                                UP TO <Text style={styles.percentText}>50%</Text> OFF
                            </Text>
                            <TouchableOpacity style={styles.shopNowBtn} onPress={() => navigation.navigate("ProductListingFromHome", { categoryName: "Valentine Specials", searchQuery: "valentine" })}>
                                <Text style={styles.shopNowText}>Shop Now</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.bannerRight}>
                            <Image 
                                source={{ uri: "https://cdn-icons-png.flaticon.com/512/9623/9623719.png" }} 
                                style={styles.bannerImageRight} 
                            />
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Best Gifts Section */}
            <Text style={styles.sectionTitle}>Best Gifts for Your Valentine</Text>
            
            <View style={styles.grid}>
                {bestGifts.map((item) => (
                    <View key={item.id} style={styles.productCard}>
                        <View style={styles.productImageContainer}>
                            <Image source={{ uri: item.image }} style={styles.productImage} />
                            <MaterialIcons name="favorite" size={20} color="#FF5252" style={styles.favIcon} />
                        </View>
                        <View style={styles.productInfo}>
                            <Text style={styles.productName}>{item.name}</Text>
                            <Text style={styles.productPrice}>${item.price}</Text>
                            <TouchableOpacity style={styles.addToCartBtn}>
                                <Text style={styles.addToCartText}>Add to Cart</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>

            {/* Special Offers Header */}
             <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Special Offers</Text>
                <TouchableOpacity onPress={() => navigation.navigate("ProductListingFromHome", { categoryName: "Valentine Specials", searchQuery: "valentine" })}>
                    <Text style={styles.viewAllText}>View All {'>'}</Text>
                </TouchableOpacity>
            </View>

             {/* Bottom Product Row (Placeholder for Special Offers) */}
             <View style={styles.offersRow}>
                <View style={styles.offerCard}>
                    <Image source={{ uri: "https://images.unsplash.com/photo-1576618148400-f54bed99fcf8?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" }} style={styles.offerImage} />
                </View>
                 <View style={styles.offerCard}>
                    <Image source={{ uri: "https://images.unsplash.com/photo-1562690868-60bbe7293e94?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" }} style={styles.offerImage} />
                </View>
             </View>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#880E4F',
    fontFamily: 'IndieFlower', 
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#AD1457',
    fontWeight: '500',
    textAlign: 'center',
  },
  bannerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bannerGradient: {
    padding: 20,
    height: 180,
    justifyContent: 'center',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  bannerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  bannerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bannerImageLeft: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    transform: [{ rotate: '-15deg' }],
  },
  bannerImageRight: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    transform: [{ rotate: '15deg' }],
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: 'IndieFlower',
    color: '#880E4F',
    fontWeight: 'bold',
  },
  saleBadge: {
    backgroundColor: '#C2185B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginVertical: 4,
  },
  saleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  discountText: {
    fontSize: 16,
    color: '#880E4F',
    marginVertical: 4,
  },
  percentText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  shopNowBtn: {
    backgroundColor: '#D81B60',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    elevation: 3,
  },
  shopNowText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#880E4F',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'serif',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  productCard: {
    width: (width - 40) / 2,
    backgroundColor: '#FFF0F5', 
    borderRadius: 16,
    marginBottom: 16,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  productImageContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    resizeMode: 'cover',
  },
  favIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  productInfo: {
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  addToCartBtn: {
    backgroundColor: '#FFCC80',
    width: '100%',
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  addToCartText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3E2723',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#880E4F',
    fontWeight: 'bold',
  },
  offersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offerCard: {
    width: (width - 40) / 2,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  offerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  }
});

export default ValentineSpecialsScreen;