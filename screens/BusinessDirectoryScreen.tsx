import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

interface Business {
  id: string;
  name: string;
  type: string;
  phoneNumber: string;
  inTime: string;
  outTime: string;
  isAvailable: boolean;
}

const BusinessDirectoryScreen: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchName, setSearchName] = useState(''); // State for name search
  const [selectedType, setSelectedType] = useState(''); // State for type filter
  const [showActiveOnly, setShowActiveOnly] = useState(false); // Toggle for active businesses
  const [types, setTypes] = useState<string[]>([]); // State for storing unique types

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('businessDetails')
      .onSnapshot(
        (querySnapshot) => {
          const businessList: Business[] = [];
          const typeSet = new Set<string>(); // Using Set to store unique types

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const inTime = data.inTime || '00:00';
            const outTime = data.outTime || '23:59';

            const currentTime = new Date();
            const [inHour, inMin] = inTime.split(':').map(Number);
            const [outHour, outMin] = outTime.split(':').map(Number);

            const inDate = new Date();
            inDate.setHours(inHour, inMin, 0, 0);
            const outDate = new Date();
            outDate.setHours(outHour, outMin, 0, 0);

            const isOpen = currentTime >= inDate && currentTime <= outDate;

            // Add each business type to the Set
            typeSet.add(data.type);

            businessList.push({
              id: doc.id,
              name: data.name,
              type: data.type,
              phoneNumber: data.phoneNumber,
              inTime,
              outTime,
              isAvailable: isOpen,
            });
          });

          // Sort businesses to show available ones first
          businessList.sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));

          setBusinesses(businessList);
          setFilteredBusinesses(businessList);
          setTypes(Array.from(typeSet)); // Convert Set to Array for the Picker
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching business details:', error);
          Alert.alert('Error', 'Failed to load businesses. Please try again.');
        }
      );

    return () => unsubscribe();
  }, []);

  // Filter the business list based on user input
  useEffect(() => {
    let filtered = businesses;

    // Filter by name
    if (searchName) {
      filtered = filtered.filter((business) =>
        business.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType) {
      filtered = filtered.filter((business) => business.type === selectedType);
    }

    // Filter by availability
    if (showActiveOnly) {
      filtered = filtered.filter((business) => business.isAvailable);
    }

    setFilteredBusinesses(filtered);
  }, [searchName, selectedType, showActiveOnly, businesses]);

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() =>
      Alert.alert('Error', 'Unable to make the call.')
    );
  };

  const renderBusiness = ({ item }: { item: Business }) => (
    <View style={[styles.card, !item.isAvailable && styles.cardDisabled]}>
      <View style={styles.businessInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.type}>{item.type}</Text>
      </View>
      <TouchableOpacity
        style={styles.callButton}
        onPress={() => handleCall(item.phoneNumber)}
        disabled={!item.isAvailable}
      >
        <Ionicons name="call" size={24} color={item.isAvailable ? '#4CAF50' : '#999'} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search by Name */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name..."
        value={searchName}
        onChangeText={setSearchName}
      />

      {/* Filter by Type */}
      <Picker
        selectedValue={selectedType}
        onValueChange={(itemValue) => setSelectedType(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="All Types" value="" />
        {types.map((type) => (
          <Picker.Item key={type} label={type} value={type} />
        ))}
      </Picker>

      {/* Toggle for Active Businesses */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowActiveOnly((prev) => !prev)}
      >
        <Text style={styles.filterButtonText}>
          {showActiveOnly ? 'Show All' : 'Show Active Only'}
        </Text>
      </TouchableOpacity>

      {/* Business List */}
      <FlatList
        data={filteredBusinesses}
        keyExtractor={(item) => item.id}
        renderItem={renderBusiness}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  picker: {
    height: 40,
    marginBottom: 10,
  },
  filterButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  filterButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
  list: {
    paddingTop: 10,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  businessInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  type: {
    fontSize: 14,
    color: '#777',
  },
  callButton: {
    marginLeft: 10,
  },
});

export default BusinessDirectoryScreen;
