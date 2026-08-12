import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid, Linking, Alert } from "react-native";
import ManualPunchScreen from "./ManualPunchScreen";
import AutoTrackScreen from "./AutoTrackScreen";
import { initBackgroundFetch, stopBackgroundFetch } from "../services/backgroundTracker";
import { getStoredPunchStatus } from "../services/api";
import NetInfo from "@react-native-community/netinfo";
import { useLanguage, LANGUAGE_OPTIONS } from "../utils/language";
import { uploadQueuedPunches } from "../services/api";

// Auto Track is no longer a visible tab - employees should not see or know
// it exists as a separate feature. It still runs exactly the same way:
// AutoTrackScreen is always mounted (renders nothing) and starts/stops
// itself based on `isPunchedIn`, driven by Punch In / Punch Out.
export default function HomeScreen({ user, onLogout }) {
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [needsLocationPrompt, setNeedsLocationPrompt] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    restorePunchStatus();
    uploadQueuedPunches().catch(console.log);
    checkLocationPermission();
    if (user) initBackgroundFetch(user);
 
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        uploadQueuedPunches().catch(console.log);
      }
    });
 
    return () => unsubscribe();
  }, [user]);

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
          title: t('allowLocation'),
          message: t('backgroundPermissionNeeded'),
          buttonPositive: t('allow'),
          buttonNegative: t('cancel'),
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setNeedsLocationPrompt(false);
        Alert.alert(t('locationEnabled'), t('locationEnabledMessage'));
      } else {
        Alert.alert(
          t('permissionNeededTitle'),
          t('pleaseEnableFromSettings'),
        );
      }
    } catch (err) {
      console.log("Permission request failed:", err.message);
    }
  }

  function openLocationSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert(t('unableToOpenSettings'), t('pleaseEnableFromSettings'));
    });
  }

  const handlePunchStatusChange = (type) => {
    setIsPunchedIn(type === "in");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      {needsLocationPrompt && (
        <View style={styles.permissionBanner}>
          <Text style={styles.bannerText}>{t('locationPermissionBanner')}</Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.bannerButton} onPress={requestLocationPermission}>
              <Text style={styles.bannerButtonText}>{t('enableLocation')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerLink} onPress={openLocationSettings}>
              <Text style={styles.bannerLinkText}>{t('settings')}</Text>
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

      <View style={styles.languageSection}>
        <Text style={styles.languageLabel}>{t('changeLanguage')}</Text>
        <View style={styles.languageButtons}>
          {LANGUAGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.code}
              style={[
                styles.languageOption,
                language === option.code && styles.languageOptionActive,
              ]}
              onPress={() => setLanguage(option.code)}
            >
              <Text style={language === option.code ? styles.languageOptionTextActive : styles.languageOptionText}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>{t('logout')}</Text>
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
  languageSection: { paddingHorizontal: 24, paddingBottom: 16 },
  languageLabel: { color: "#f1f5f9", marginBottom: 10, fontSize: 14 },
  languageButtons: { flexDirection: "row", justifyContent: "space-between" },
  languageOption: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  languageOptionActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  languageOptionText: { color: "#f1f5f9", fontSize: 13 },
  languageOptionTextActive: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
});
