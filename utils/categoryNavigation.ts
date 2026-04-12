import firestore from "@react-native-firebase/firestore";

export const navigateToSpecializedCategory = async (
  name: string,
  storeId: string,
  nav: any,
  maybeNavigateCat: (cat: any) => void
) => {
  const normalizedName = name.trim();

  // 1. Pooja Essentials -> Category "Pooja Essentials"
  if (normalizedName === "Pooja Essentials") {
    try {
      const snap = await firestore()
        .collection("categories")
        .where("storeId", "==", storeId)
        .where("name", "==", "Pooja Essentials")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        maybeNavigateCat({ id: doc.id, ...doc.data() });
        return true;
      }
    } catch (e) {
      console.error("Error finding Pooja Essentials:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Pooja Essentials",
      searchQuery: "pooja",
    });
    return true;
  }

  // 2. Fruits -> Subcategory "Fruits" under "Fresh Greens"
  if (normalizedName === "Fruits") {
    try {
      const snap = await firestore()
        .collection("subcategories")
        .where("storeId", "==", storeId)
        .where("categoryId", "==", "Fresh Greens")
        .where("name", "==", "Fruits")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        nav.navigate("ProductListingFromHome", {
          categoryId: "Fresh Greens",
          categoryName: "Fruits",
          subcategoryId: doc.id,
        });
        return true;
      }
    } catch (e) {
      console.error("Error finding Fruits subcategory:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Fruits",
      searchQuery: "fruits",
    });
    return true;
  }

  // 3. Vegetables -> Subcategory "Vegetables" under "Fresh Greens"
  if (normalizedName === "Vegetables") {
    try {
      const snap = await firestore()
        .collection("subcategories")
        .where("storeId", "==", storeId)
        .where("categoryId", "==", "Fresh Greens")
        .where("name", "==", "Vegetables")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        nav.navigate("ProductListingFromHome", {
          categoryId: "Fresh Greens",
          categoryName: "Vegetables",
          subcategoryId: doc.id,
        });
        return true;
      }
    } catch (e) {
      console.error("Error finding Vegetables subcategory:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Vegetables",
      searchQuery: "vegetables",
    });
    return true;
  }

  // 4. Exotic -> Subcategory "Exotic" under "Fresh Greens"
  if (normalizedName === "Exotic") {
    nav.navigate("ProductListingFromHome", {
      categoryId: "Fresh Greens",
      categoryName: "Exotic",
      subcategoryId: "Exotic",
    });
    return true;
  }

  // 5. Special -> Subcategory "Special" under "Fresh Greens"
  if (normalizedName === "Special") {
    nav.navigate("ProductListingFromHome", {
      categoryId: "Fresh Greens",
      categoryName: "Special",
      subcategoryId: "Special",
    });
    return true;
  }

  // 6. Chocolates -> Subcategory "Chocolate & Sweets" under "Snacks & Ready-to-Eat"
  if (normalizedName === "Chocolates") {
    try {
      const snap = await firestore()
        .collection("subcategories")
        .where("storeId", "==", storeId)
        .where("categoryId", "==", "Snacks & Ready-to-Eat")
        .where("name", "==", "Chocolate & Sweets")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        nav.navigate("ProductListingFromHome", {
          categoryId: "Snacks & Ready-to-Eat",
          categoryName: "Chocolate & Sweets",
          subcategoryId: doc.id,
        });
        return true;
      }
    } catch (e) {
      console.error("Error finding Chocolate & Sweets:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Chocolate & Sweets",
      searchQuery: "chocolate",
    });
    return true;
  }

  // 7. Dairy -> Category "Dairy, Bread & Eggs"
  if (normalizedName === "Dairy") {
    try {
      const snap = await firestore()
        .collection("categories")
        .where("storeId", "==", storeId)
        .where("name", "==", "Dairy, Bread & Eggs")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        maybeNavigateCat({ id: doc.id, ...doc.data() });
        return true;
      }
    } catch (e) {
      console.error("Error finding Dairy:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Dairy, Bread & Eggs",
      searchQuery: "dairy milk bread eggs",
    });
    return true;
  }

  // 8. Dry Fruits -> Category "Dry Fruits"
  if (normalizedName === "Dry Fruits") {
    try {
      const snap = await firestore()
        .collection("categories")
        .where("storeId", "==", storeId)
        .where("name", "==", "Dry Fruits")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        maybeNavigateCat({ id: doc.id, ...doc.data() });
        return true;
      }
    } catch (e) {
      console.error("Error finding Dry Fruits:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Dry Fruits",
      searchQuery: "dry fruits",
    });
    return true;
  }

  // 9. Instant Food -> Category "Instant Food"
  if (normalizedName === "Instant Food") {
    try {
      const snap = await firestore()
        .collection("categories")
        .where("storeId", "==", storeId)
        .where("name", "==", "Instant Food")
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        maybeNavigateCat({ id: doc.id, ...doc.data() });
        return true;
      }
    } catch (e) {
      console.error("Error finding Instant Food:", e);
    }
    nav.navigate("ProductListingFromHome", {
      categoryName: "Instant Food",
      searchQuery: "instant food",
    });
    return true;
  }

  return false; // Not a specialized category
};
