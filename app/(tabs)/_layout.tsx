import { Tabs } from "expo-router";
import { ImageBackground, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabLayout() {
  return (
    <ImageBackground source={require("../../assets/images/socialdownload-inicio.png")} style={styles.background} resizeMode="cover">
      <Tabs screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#075985",
        tabBarInactiveTintColor: "#475569",
        tabBarLabelStyle: { fontFamily: "Poppins_500Medium", fontSize: 9, marginTop: -2 },
        tabBarIconStyle: { marginTop: -3 },
        tabBarStyle: styles.tabBar,
        tabBarActiveBackgroundColor: "transparent",
        tabBarItemStyle: { borderRadius: 15, marginHorizontal: 1, marginVertical: 4 },
      }}>
        <Tabs.Screen name="downloads" options={{ title: "Downloads", tabBarIcon: ({ focused }) => <Ionicons name={focused ? "download" : "download-outline"} size={23} color={focused ? "#075985" : "#475569"} /> }} />
        <Tabs.Screen name="videos" options={{ title: "Vídeos", tabBarIcon: ({ focused }) => <Ionicons name={focused ? "videocam" : "videocam-outline"} size={23} color={focused ? "#075985" : "#475569"} /> }} />
        <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ focused }) => <Ionicons name={focused ? "grid" : "grid-outline"} size={23} color={focused ? "#075985" : "#475569"} /> }} />
        <Tabs.Screen name="status" options={{ title: "Status", tabBarIcon: ({ focused }) => <Ionicons name="logo-whatsapp" size={23} color={focused ? "#075985" : "#475569"} /> }} />
        <Tabs.Screen name="ajustes" options={{ title: "Ajustes", tabBarIcon: ({ focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} size={23} color={focused ? "#075985" : "#475569"} /> }} />
      </Tabs>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  tabBar: {
    position: "absolute",
    bottom: 5,
    marginHorizontal: 14,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 20,
    paddingTop: 3,
    paddingBottom: 3,
    elevation: 0,
    shadowOpacity: 0,
  },
});
