import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid, Linking, Alert } from "react-native";
import ManualPunchScreen from "./ManualPunchScreen";
import AutoTrackScreen from "./AutoTrackScreen";
import { initBackgroundFetch, stopBackgroundFetch } from "../services/backgroundTracker";
import { getStoredPunchStatus } from "../services/api";

// Auto Track is no longer a visible tab - employees should not see or know
// it exists as a separate feature. It still runs exactly the same way:
// AutoTrackScreen is always mounted (renders nothing) and starts/stops
// itself based on `isPunchedIn`, driven by Punch In / Punch Out.
export default function HomeScreen({ user, onLogout }) {
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [needsLocationPrompt, setNeedsLocationPrompt] = useState(false);

  useEffect(() => {
    restorePunchStatus();
    initBackgroundFetch(user);
    checkLocationPermission();
    return () => stopBackgroundFetch();
  }, []);

  async function restorePunchStatus() {
    try {
      const saved = await getStoredPunchStatus();
      setIsPunchedIn(saved);
    } catch (err) {
      console.log("Could not restore punch status:", err.message);
    }
  }

  async function checkLocationPermission() {
    if (Platform.OS !== "android") return;
    if (!user?.autoSchedule?.enabled) return;

    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
      if (!granted) {
        setNeedsLocationPrompt(true);
      }
    } catch (err) {
      console.log("Location permission check failed:", err.message);
    }
  }

  async function requestLocationPermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: "Allow location access",
          message: "This app needs location permission to work correctly. Please allow location access.",
          buttonPositive: "Allow",
          buttonNegative: "Cancel",
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setNeedsLocationPrompt(false);
        Alert.alert("Location enabled", "Location permission is now allowed.");
      } else {
        Alert.alert(
          "Permission needed",
          "Location permission is required for this app to work correctly. Please tap Enable again or use Settings.",
        );
      }
    } catch (err) {
      console.log("Permission request failed:", err.message);
    }
  }

  function openLocationSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert("Unable to open settings", "Please enable location permission from your device settings.");
    });
  }

  const handlePunchStatusChange = (type) => {
    setIsPunchedIn(type === "in");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      {needsLocationPrompt && (
        <View style={styles.permissionBanner}>
          <Text style={styles.bannerText}>Location permission is needed for this app.</Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.bannerButton} onPress={requestLocationPermission}>
              <Text style={styles.bannerButtonText}>Enable</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerLink} onPress={openLocationSettings}>
              <Text style={styles.bannerLinkText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <ManualPunchScreen user={user} onPunchStatusChange={handlePunchStatusChange} />
      </View>

      {/* Invisible - keeps auto-tracking running between Punch In/Out
          without showing any UI or tab for it. */}
      <AutoTrackScreen user={user} active={isPunchedIn} />

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  logoutButton: { padding: 16, alignItems: "center" },
  logoutText: { color: "#f87171", fontSize: 13 },
  permissionBanner: {
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    padding: 14,
  },
  bannerText: { color: "#f8fafc", fontSize: 13, marginBottom: 10 },
  bannerActions: { flexDirection: "row", alignItems: "center" },
  bannerButton: {
    backgroundColor: "#22c55e",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginRight: 12,
  },
  bannerButtonText: { color: "#081c15", fontWeight: "700" },
  bannerLink: { paddingVertical: 10, paddingHorizontal: 18 },
  bannerLinkText: { color: "#60a5fa", fontWeight: "700" },
});
