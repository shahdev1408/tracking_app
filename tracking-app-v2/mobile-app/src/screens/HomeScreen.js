import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ManualPunchScreen from "./ManualPunchScreen";
import AutoTrackScreen from "./AutoTrackScreen";
import { initBackgroundFetch, stopBackgroundFetch } from "../services/backgroundTracker";

// Two clearly separate tabs. Auto Track only runs BETWEEN Punch In and
// Punch Out - it does not start the moment the app opens, and it stops
// completely once the employee punches out.
export default function HomeScreen({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("manual");
  const [isPunchedIn, setIsPunchedIn] = useState(false);

  useEffect(() => {
    initBackgroundFetch();
    return () => stopBackgroundFetch();
  }, []);

  const handlePunchStatusChange = (type) => {
    setIsPunchedIn(type === "in");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "manual" && styles.tabActive]}
          onPress={() => setActiveTab("manual")}
        >
          <Text style={[styles.tabText, activeTab === "manual" && styles.tabTextActive]}>Manual Punch</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "auto" && styles.tabActive]}
          onPress={() => setActiveTab("auto")}
        >
          <Text style={[styles.tabText, activeTab === "auto" && styles.tabTextActive]}>Auto Track</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "manual" ? (
          <ManualPunchScreen user={user} onPunchStatusChange={handlePunchStatusChange} />
        ) : (
          <AutoTrackScreen user={user} active={isPunchedIn} />
        )}
      </View>

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: "row", backgroundColor: "#1e293b" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: "#22c55e" },
  tabText: { color: "#64748b", fontWeight: "bold", fontSize: 13 },
  tabTextActive: { color: "#22c55e" },
  logoutButton: { padding: 16, alignItems: "center" },
  logoutText: { color: "#f87171", fontSize: 13 },
});
