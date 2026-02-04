import firestore from '@react-native-firebase/firestore';

export interface PromoBanner {
  id: string;
  name: string;
  imageUrl: string;
  enabled: boolean;
  priority: number;
  navigateTo: string;
  storeId: string;
}

export const fetchPromoBanners = async (storeId: string): Promise<PromoBanner[]> => {
  try {
    const snapshot = await firestore()
      .collection('z_banners')
      .where('enabled', '==', true)
      .where('storeId', '==', storeId)
      .orderBy('priority', 'asc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PromoBanner[];
  } catch (error) {
    console.error('Error fetching banners:', error);
    return [];
  }
};