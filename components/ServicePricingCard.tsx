import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Package {
  id: string;
  name: string;
  price: number;
  duration: number;
  unit: string;
  features?: string[];
  isPopular?: boolean;
  originalPrice?: number;
  discount?: number;
}

interface ServicePricingCardProps {
  company: any;
  onPackageSelect?: (packageData: Package) => void;
  onDirectPriceSelect?: (price: number) => void;
  selectedPackageId?: string;
}

export default function ServicePricingCard({
  company,
  onPackageSelect,
  onDirectPriceSelect,
  selectedPackageId,
}: ServicePricingCardProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(selectedPackageId || null);

  // ✅ FIXED: More strict package checking
  const hasPackages = company.packages && 
                     Array.isArray(company.packages) && 
                     company.packages.length > 0 &&
                     // Additional check: ensure packages are not just empty objects
                     company.packages.some((pkg: any) => 
                       pkg && (typeof pkg === 'string' || 
                              (typeof pkg === 'object' && (pkg.name || pkg.price)))
                     );

  const handlePackageSelection = (pkg: Package) => {
    setSelectedPackage(pkg.id);
    onPackageSelect?.(pkg);
  };

  const handleDirectPriceSelection = () => {
    onDirectPriceSelect?.(company.price);
  };

  console.log(`🎯 ServicePricingCard: ${company.companyName || company.serviceName}`);
  console.log(`   - Has packages: ${hasPackages}`);
  console.log(`   - Packages data:`, company.packages);
  console.log(`   - Direct price: ${company.price}`);

  if (!hasPackages) {
    // Direct pricing flow
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{company.companyName || company.serviceName}</Text>
          {company.isActive && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        <View style={styles.directPricingCard}>
          <View style={styles.pricingHeader}>
            <Text style={styles.pricingTitle}>💰 Direct Service Pricing</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{company.price || 0}</Text>
              <Text style={styles.priceUnit}>per service</Text>
            </View>
          </View>

          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>Includes:</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark" size={16} color="#4CAF50" />
                <Text style={styles.featureText}>Professional technician</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark" size={16} color="#4CAF50" />
                <Text style={styles.featureText}>Quality guarantee</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark" size={16} color="#4CAF50" />
                <Text style={styles.featureText}>Customer support</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.selectButton}
            onPress={handleDirectPriceSelection}
          >
            <Text style={styles.selectButtonText}>Select Service</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Package-based pricing flow
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{company.companyName || company.serviceName}</Text>
        {company.isActive && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      <Text style={styles.packagesTitle}>📦 Choose Your Package</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScroll}>
        {company.packages.map((pkg: Package, index: number) => {
          const isSelected = selectedPackage === pkg.id;
          const hasDiscount = pkg.originalPrice && pkg.originalPrice > pkg.price;
          
          return (
            <TouchableOpacity
              key={pkg.id || index}
              style={[
                styles.packageCard,
                isSelected && styles.packageCardSelected,
                pkg.isPopular && styles.popularPackage,
              ]}
              onPress={() => handlePackageSelection(pkg)}
            >
              {pkg.isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              )}

              <Text style={styles.packageName}>{pkg.name}</Text>
              
              <View style={styles.packagePriceContainer}>
                <Text style={styles.packagePrice}>₹{pkg.price}</Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>₹{pkg.originalPrice}</Text>
                )}
                <Text style={styles.packageUnit}>/{pkg.unit || 'service'}</Text>
              </View>

              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {Math.round(((pkg.originalPrice! - pkg.price) / pkg.originalPrice!) * 100)}% OFF
                  </Text>
                </View>
              )}

              <Text style={styles.packageDuration}>Duration: {pkg.duration} {pkg.unit === 'month' ? 'month' : 'hours'}</Text>

              {pkg.features && pkg.features.length > 0 && (
                <View style={styles.packageFeatures}>
                  {pkg.features.slice(0, 3).map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Ionicons name="checkmark" size={14} color="#4CAF50" />
                      <Text style={styles.packageFeatureText}>{feature}</Text>
                    </View>
                  ))}
                  {pkg.features.length > 3 && (
                    <Text style={styles.moreFeatures}>+{pkg.features.length - 3} more</Text>
                  )}
                </View>
              )}

              {isSelected && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.selectedText}>Selected</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Direct pricing styles
  directPricingCard: {
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f0fdf4',
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803d',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#15803d',
  },
  priceUnit: {
    fontSize: 12,
    color: '#65a30d',
  },
  
  // Package-based pricing styles
  packagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  packagesScroll: {
    marginBottom: 8,
  },
  packageCard: {
    width: 200,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  packageCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  popularPackage: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  packageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
    marginTop: 8,
  },
  packagePriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e40af',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 4,
  },
  packageUnit: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 2,
  },
  discountBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  discountText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  packageDuration: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  packageFeatures: {
    marginBottom: 12,
  },
  packageFeatureText: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 4,
  },
  moreFeatures: {
    fontSize: 11,
    color: '#2563eb',
    fontStyle: 'italic',
    marginTop: 4,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectedText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Common styles
  featuresContainer: {
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  featuresList: {
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
  },
  selectButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});