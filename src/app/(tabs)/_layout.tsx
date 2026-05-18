import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

type TabConfig = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
};

const TAB_CONFIG: TabConfig[] = [
  {
    name: "index",
    label: "RADAR",
    icon: "locate",
    iconOutline: "locate-outline",
  },
  {
    name: "scout",
    label: "SCOUT",
    icon: "camera",
    iconOutline: "camera-outline",
  },
  {
    name: "profile",
    label: "PROFILE",
    icon: "person",
    iconOutline: "person-outline",
  },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      <View style={styles.topBorder} />
      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = TAB_CONFIG.find((t) => t.name === route.name);
          if (!tab) return null;

          const color = isFocused ? theme.colors.accent : theme.colors.textMuted;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tab}
            >
              {isFocused && <View style={styles.activeBar} />}
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Ionicons
                  name={isFocused ? tab.icon : tab.iconOutline}
                  size={21}
                  color={color}
                />
              </View>
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scout" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.backgroundElevated,
  },
  topBorder: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  tabs: {
    flexDirection: "row",
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  activeBar: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 2,
    backgroundColor: theme.colors.accent,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    // Glow effect on the active indicator
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  iconWrapActive: {
    backgroundColor: theme.colors.accentDim,
  },
  label: {
    ...theme.type.tag,
  },
});
