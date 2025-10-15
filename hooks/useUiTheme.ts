// hooks/useUiTheme.ts
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

export type UiTheme = {
  productCardBg: string;
  productImageBg: string;
  discountTagBg: string;
  priceOverlayBg: string;
  addToCartBg: string;
  qtyBarBg: string;
  qtyBtnBg: string;
  qtyBtnBorder: string;
  oosBg: string;
};

const DEFAULTS: UiTheme = {
  productCardBg: "#FFFFFF",
  productImageBg: "#f8f9fa",
  discountTagBg: "#d35400",
  priceOverlayBg: "#16a085",
  addToCartBg: "#27ae60",
  qtyBarBg: "#f8f9fa",
  qtyBtnBg: "#27ae60",
  qtyBtnBorder: "#27ae60",
  oosBg: "#bdc3c7",
};

export function useUiTheme(storeId?: string | null) {
  const [overrides, setOverrides] = useState<Partial<UiTheme>>({});

  useEffect(() => {
    let unsubStore: undefined | (() => void);
    let unsubDefault: undefined | (() => void);

    const col = firestore().collection("ui_theme");

    const listenDefault = () => {
      unsubDefault = col
        .where("isDefault", "==", true) // mark your global doc(s) with isDefault: true
        .limit(1)
        .onSnapshot(
          s => {
            const d = s.docs[0]?.data() as Partial<UiTheme> | undefined;
            setOverrides(d ?? {});
          },
          () => setOverrides({})
        );
    };

    // Prefer store-specific active theme if storeId is present
    if (storeId) {
      unsubStore = col
        .where("storeId", "==", storeId)
        .where("active", "==", true)
        .limit(1)
        .onSnapshot(
          s => {
            if (!s.empty) {
              const d = s.docs[0].data() as Partial<UiTheme>;
              setOverrides(d ?? {});
            } else {
              // fallback to default when no active store theme
              listenDefault();
            }
          },
          () => {
            // if store query fails, fallback to default
            listenDefault();
          }
        );
    } else {
      // no storeId → just use default
      listenDefault();
    }

    return () => {
      unsubStore?.();
      unsubDefault?.();
    };
  }, [storeId]);

  const theme = useMemo<UiTheme>(() => ({ ...DEFAULTS, ...overrides }), [overrides]);
  return theme;
}
