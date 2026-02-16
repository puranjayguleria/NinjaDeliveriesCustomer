import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeQuantityOfferPricing } from "../utils/serviceQuantityOffers";

export type ServiceCartItem = {
  id: string;
  serviceTitle: string;
  categoryId?: string; // Add categoryId for add-on services filtering
  issues: (string | { name: string; price: number; quantity?: number })[]; // Support both string and object formats
  company: {
    id: string;
    companyId?: string; // Add companyId field for compatibility
    name: string;
    price?: number;
    time?: string;
    rating?: number;
    experience?: string;
    verified?: boolean;
    specialties?: string[];
  };
  selectedDate: string;
  selectedTime: string;
  quantity: number;
  unitPrice: number; // per-item price stored to avoid depending on company.price later
  totalPrice: number;
  bookingType: 'electrician' | 'plumber' | 'cleaning' | 'health' | 'dailywages' | 'carwash';
  additionalInfo?: any; // For service-specific data
  addOns?: any[]; // Add-on services selected during checkout
};

type ServiceCartState = {
  items: Record<string, ServiceCartItem>; // key = unique service booking ID
};

type ServiceCartContextType = {
  state: ServiceCartState;
  addService: (service: Omit<ServiceCartItem, "quantity" | "id"> & { quantity?: number }) => void;
  removeService: (serviceId: string) => void;
  updateService: (serviceId: string, updates: Partial<ServiceCartItem>) => void;
  clearCart: () => void;
  getServiceById: (serviceId: string) => ServiceCartItem | undefined;
  totalItems: number;
  totalAmount: number;
  hasServices: boolean;
};

const ServiceCartContext = createContext<ServiceCartContextType | undefined>(
  undefined
);

export const useServiceCart = (): ServiceCartContextType => {
  const ctx = useContext(ServiceCartContext);
  if (!ctx) {
    throw new Error(
      "useServiceCart must be used within a ServiceCartProvider"
    );
  }
  return ctx;
};

const CART_STORAGE_KEY = "@service_cart_data";

export const ServiceCartProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ServiceCartState>({
    items: {},
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          setState(parsedCart);
        }
      } catch (error) {
        console.error("Failed to load cart from storage:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      const saveCart = async () => {
        try {
          await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
          console.error("Failed to save cart to storage:", error);
        }
      };
      saveCart();
    }
  }, [state, isLoaded]);

  const addService = (service: Omit<ServiceCartItem, "quantity" | "id"> & { unitPrice?: number; totalPrice?: number; quantity?: number }) => {
    // Generate unique ID for this service booking
    const serviceId = `${service.bookingType}_${service.company.id}_${Date.now()}`;

    // Derive a reliable price.
    // Some flows pass issues without price, or totalPrice/unitPrice as 0; we recover from issues/package/company.
    const explicitUnit = typeof (service as any).unitPrice === 'number' ? (service as any).unitPrice : undefined;
    const explicitTotal = typeof (service as any).totalPrice === 'number' ? (service as any).totalPrice : undefined;

    const issuesTotal = (service.issues || []).reduce((sum: number, issue: any) => {
      const obj = typeof issue === 'object' ? issue : { name: issue, price: undefined, quantity: 1 };
      const p = typeof obj?.price === 'number'
        ? obj.price
        : (typeof service.company?.price === 'number' ? service.company.price : 0);
      const q = typeof obj?.quantity === 'number' ? obj.quantity : 1;
      return sum + p * q;
    }, 0);

    const packagePrice = Number((service as any)?.additionalInfo?.package?.price);
    const derivedTotal =
      (Number.isFinite(packagePrice) && packagePrice > 0)
        ? packagePrice
        : issuesTotal;

    // Priority (best -> fallback): explicit total > 0, explicit unit > 0, derivedTotal > 0, company.price > 0, else 0.
    const companyPrice = typeof service.company?.price === 'number' ? service.company.price : 0;

    // When quantity offers exist, treat the pricing input as per-unit.
    // Some flows compute `derivedTotal` as the sum of selected issues, which is not a per-unit base.
    const hasQuantityOffers = Array.isArray((service as any)?.additionalInfo?.quantityOffers)
      && (service as any)?.additionalInfo?.quantityOffers.length > 0;
    const forcedOfferBaseUnit = Number((service as any)?.additionalInfo?.baseOfferUnitPrice);

    const unitPrice = (hasQuantityOffers && Number.isFinite(forcedOfferBaseUnit) && forcedOfferBaseUnit > 0)
      ? forcedOfferBaseUnit
      : ((explicitUnit && explicitUnit > 0)
        ? explicitUnit
        : (derivedTotal > 0 ? derivedTotal : companyPrice));

    const totalPrice = (explicitTotal && explicitTotal > 0)
      ? explicitTotal
      : (derivedTotal > 0 ? derivedTotal : unitPrice * 1);

    console.log("🧾 [ServiceCart] addService pricing", {
      serviceTitle: (service as any)?.serviceTitle,
      explicitUnit,
      explicitTotal,
      issuesTotal,
      packagePrice,
      companyPrice,
      computedUnitPrice: unitPrice,
      computedTotalPrice: totalPrice,
      issuesSample: Array.isArray((service as any)?.issues) ? (service as any).issues.slice(0, 2) : (service as any)?.issues,
    });

    const initialQty = Math.max(1, Number((service as any).quantity) || 1);
    const newService: ServiceCartItem = {
      ...service,
      id: serviceId,
      quantity: initialQty,
      unitPrice,
      totalPrice: typeof explicitTotal === 'number' && explicitTotal > 0
        ? explicitTotal
        : (unitPrice * initialQty),
    } as ServiceCartItem;

    // Apply quantity offers immediately if available so the next screen sees the discounted price.
    const offers = (newService as any)?.additionalInfo?.quantityOffers;
    if (Array.isArray(offers) && offers.length > 0) {
      const pricing = computeQuantityOfferPricing({
        baseUnitPrice: unitPrice,
        quantity: initialQty,
        offers,
      });
      newService.totalPrice = pricing.totalPrice;
      (newService as any).additionalInfo = {
        ...(newService as any).additionalInfo,
        appliedQuantityOffer: pricing.appliedOffer || null,
        effectiveUnitPrice: pricing.effectiveUnitPrice,
        quantityOfferSavings: pricing.savings,
      };
    }

    // 🔥 SINGLE SERVICE RESTRICTION: Clear existing services before adding new one
    setState((prev) => ({
      ...prev,
      items: {
        [serviceId]: newService, // Only keep the new service, remove all previous ones
      },
    }));
  };

  const removeService = (serviceId: string) => {
    setState((prev) => {
      const newItems = { ...prev.items };
      delete newItems[serviceId];
      return {
        ...prev,
        items: newItems,
      };
    });
  };

  const updateService = (serviceId: string, updates: Partial<ServiceCartItem>) => {
    setState((prev) => {
      const existingService = prev.items[serviceId];
      if (!existingService) return prev;

      const updatedService = {
        ...existingService,
        ...updates,
      };

      // If an explicit totalPrice is provided in updates, use it. Otherwise recalculate.
      // IMPORTANT: if this item has quantityOffers, always apply them when quantity/unit changes.
      if (updates.totalPrice !== undefined) {
        updatedService.totalPrice = updates.totalPrice as number;
      } else if (
        updates.quantity !== undefined ||
        updates.unitPrice !== undefined ||
        updates.company?.price !== undefined ||
        (updatedService as any)?.additionalInfo?.quantityOffers
      ) {
        const unit = typeof updatedService.unitPrice === 'number'
          ? updatedService.unitPrice
          : (typeof updatedService.company?.price === 'number' ? updatedService.company.price : 0);

        const offers = (updatedService as any)?.additionalInfo?.quantityOffers;
        if (Array.isArray(offers) && offers.length > 0) {
          const pricing = computeQuantityOfferPricing({
            baseUnitPrice: unit,
            quantity: Number(updatedService.quantity) || 0,
            offers,
          });
          // Persist the computed total. (We keep unitPrice as the base price to avoid confusion elsewhere.)
          updatedService.totalPrice = pricing.totalPrice;
          (updatedService as any).additionalInfo = {
            ...(updatedService as any).additionalInfo,
            appliedQuantityOffer: pricing.appliedOffer || null,
            effectiveUnitPrice: pricing.effectiveUnitPrice,
            quantityOfferSavings: pricing.savings,
          };
        } else {
          updatedService.totalPrice = (updatedService.quantity || 0) * unit;
        }
      }

      return {
        ...prev,
        items: {
          ...prev.items,
          [serviceId]: updatedService,
        },
      };
    });
  };

  const clearCart = () => {
    setState({ items: {} });
  };

  const getServiceById = (serviceId: string) => {
    return state.items[serviceId];
  };

  const totalItems = useMemo(() => {
    return Object.values(state.items).reduce((sum, item) => sum + item.quantity, 0);
  }, [state.items]);

  const totalAmount = useMemo(() => {
    return Object.values(state.items).reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
  }, [state.items]);

  const hasServices = useMemo(() => {
    return Object.keys(state.items).length > 0;
  }, [state.items]);

  const contextValue: ServiceCartContextType = useMemo(
    () => ({
      state,
      addService,
      removeService,
      updateService,
      clearCart,
      getServiceById,
      totalItems,
      totalAmount,
      hasServices,
    }),
    // Keep stable with the repo's existing pattern.
    // Functions here close over setState/state and are recreated on render;
    // depending only on state avoids dependency-churn lint rules.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  return (
    <ServiceCartContext.Provider value={contextValue}>
      {children}
    </ServiceCartContext.Provider>
  );
};