import React from "react";
import { View, StyleSheet } from "react-native";

interface PaginationProps {
  dots: number;
  activeDot: number;
}

const Pagination: React.FC<PaginationProps> = ({ dots, activeDot }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: dots }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === activeDot ? styles.activeDot : styles.inactiveDot,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#000",
  },
  inactiveDot: {
    backgroundColor: "#ccc",
  },
});

export default Pagination;
