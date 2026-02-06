import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type ServiceCartItem = {
  id: string;
  serviceTitle: string;
  issues: string[];
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
  addService: (service: Omit<ServiceCartItem, "quantity" | "id">) => void;
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

export const ServiceCartProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ServiceCartState>({
    items: {},
  });

  const addService = (service: Omit<ServiceCartItem, "quantity" | "id"> & { unitPrice?: number; totalPrice?: number }) => {
    // Generate unique ID for this service booking
    const serviceId = `${service.bookingType}_${service.company.id}_${Date.now()}`;

    // Determine unitPrice and totalPrice from what was passed in.
    // Priority: explicit `unitPrice` -> explicit `totalPrice` (used as unit if unit missing) -> company.price -> 0
    const explicitUnit = typeof (service as any).unitPrice === 'number' ? (service as any).unitPrice : undefined;
    const explicitTotal = typeof (service as any).totalPrice === 'number' ? (service as any).totalPrice : undefined;

    const unitPrice = explicitUnit ?? explicitTotal ?? (typeof service.company?.price === 'number' ? service.company.price : 0);
    const totalPrice = explicitTotal ?? unitPrice * 1;

    const newService: ServiceCartItem = {
      ...service,
      id: serviceId,
      quantity: 1,
      unitPrice,
      totalPrice,
    } as ServiceCartItem;

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

      // If an explicit totalPrice is provided in updates, use it. Otherwise recalculate from unitPrice/quantity/company.price.
      if (updates.totalPrice !== undefined) {
        updatedService.totalPrice = updates.totalPrice as number;
      } else if (updates.quantity !== undefined || updates.unitPrice !== undefined || updates.company?.price !== undefined) {
        const unit = typeof updatedService.unitPrice === 'number'
          ? updatedService.unitPrice
          : (typeof updatedService.company?.price === 'number' ? updatedService.company.price : 0);
        updatedService.totalPrice = (updatedService.quantity || 0) * unit;
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
    [state]
  );

  return (
    <ServiceCartContext.Provider value={contextValue}>
      {children}
    </ServiceCartContext.Provider>
  );
};