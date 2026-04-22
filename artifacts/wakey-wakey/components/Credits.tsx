import React from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  align?: "center" | "left";
  style?: any;
};

export function Credits({ align = "center", style }: Props) {
  const colors = useColors();
  const open = () => {
    Linking.openURL("https://wyibe.com").catch(() => {});
  };
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.row,
        { justifyContent: align === "center" ? "center" : "flex-start", opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        Wakey Wakey · by
      </Text>
      <Image
        source={require("@/assets/images/wyibe.jpg")}
        style={styles.logo}
      />
      <Text style={[styles.brand, { color: colors.foreground }]}>wyibe</Text>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        · wyibe.com
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
  },
  text: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  brand: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  logo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
});
