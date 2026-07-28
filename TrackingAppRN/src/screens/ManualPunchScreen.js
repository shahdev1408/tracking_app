import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  PermissionsAndroid, Platform, Modal, Linking, Image, ScrollView
} from "react-native";
import Geolocation from "react-native-geolocation-service";
import { launchCamera } from "react-native-image-picker";
import { sendPunch, persistPunchStatus, getStoredPunchStatus } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";

export default function ManualPunchScreen({ user, onPunchStatusChange }) {
  const [loading, setLoading] = useState(false);
  
  // Tracks if the user has started their shift so we can show the Punch Out button
  const [isPunchedIn, setIsPunchedIn] = useState(false);

  useEffect(() => {
    restorePunchStatus();
  }, []);

  async function restorePunchStatus() {
    try {
      const saved = await getStoredPunchStatus();
      setIsPunchedIn(saved);
    } catch (err) {
      console.log("Could not restore punch status:", err.message);
    }
  }

  // Form State
  const [photoBase64, setPhotoBase64] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null); // 'personal' or 'project'
  const [selectedWorkType, setSelectedWorkType] = useState(null);
  const [workTypeModalVisible, setWorkTypeModalVisible] = useState(false);

  const workTypes = ["site_work", "office_work", "meeting", "tour"];

  async function requestLocationPermission() {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "This app needs your location to record site visits.",
          buttonPositive: "Allow",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  const getCurrentLocation = () =>
    new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  async function getLocationWithRetry() {
    try {
      return await getCurrentLocation();
    } catch (err) {
      if (err.code === 2) {
        return new Promise((resolve, reject) => {
          Alert.alert(
            "Location is turned off",
            "Please turn on Location/GPS to proceed, then tap Retry.",
            [
              { text: "Cancel", style: "cancel", onPress: () => reject(err) },
              {
                text: "Open Settings",
                onPress: () => {
                  if (Platform.OS === "android") {
                    Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
                  }
                  reject(err);
                },
              },
              {
                text: "Retry",
                onPress: async () => {
                  try {
                    resolve(await getCurrentLocation());
                  } catch (e2) {
                    reject(e2);
                  }
                },
              },
            ]
          );
        });
      }
      throw err;
    }
  }

  async function capturePhoto() {
    launchCamera(
      { mediaType: "photo", saveToPhotos: false, cameraType: "back", quality: 0.7, includeBase64: true },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert("Camera Error", response.errorMessage || "Failed to open camera.");
          return;
        }
        const asset = response.assets && response.assets[0];
        if (!asset || !asset.base64) {
          Alert.alert("Error", "No photo captured.");
          return;
        }
        
        if (asset.fileSize && asset.fileSize < 5000) {
          Alert.alert(
            "Unclear photo",
            "That photo looks blank or unclear (too dark/too bright). Please retake it.",
            [{ text: "Retake", onPress: capturePhoto }]
          );
          return;
        }
        setPhotoBase64(`data:image/jpeg;base64,${asset.base64}`);
      }
    );
  }

  async function handleSave() {
    if (!photoBase64) {
      Alert.alert("Validation Error", "Please capture a photo.");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Validation Error", "Please select Personal Work or Office Work.");
      return;
    }
    if (selectedCategory === "project" && !selectedWorkType) {
      Alert.alert("Validation Error", "Please select a Work Type.");
      return;
    }

    setLoading(true);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert("Permission Required", "Location permission is needed to save your log.");
        setLoading(false);
        return;
      }

      const coords = await getLocationWithRetry();
      const { deviceName, deviceId } = await getDeviceInfo();

      await sendPunch({
        type: "in", // Acts as the hourly log / punch-in
        latitude: coords.latitude,
        longitude: coords.longitude,
        punchCategory: selectedCategory,
        workType: selectedWorkType,
        photoBase64,
        deviceName,
        deviceId,
      });

      // Mark the user as punched in so the Punch Out button becomes visible
      setIsPunchedIn(true);
      await persistPunchStatus(true);
      if (onPunchStatusChange) onPunchStatusChange("in");
      Alert.alert("Success", `Log saved successfully at ${new Date().toLocaleTimeString()}`);
      
      // Reset form fields for the next hour's log
      setPhotoBase64(null);
      setSelectedCategory(null);
      setSelectedWorkType(null);
    } catch (err) {
      Alert.alert("Error", err.message || "Could not record punch. Check location permission and network.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePunchOut() {
    Alert.alert(
      "Confirm Punch Out",
      "Are you sure you want to end your shift for the day?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Punch Out",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const hasPermission = await requestLocationPermission();
              if (!hasPermission) {
                Alert.alert("Permission Required", "Location permission is needed to punch out.");
                setLoading(false);
                return;
              }
              const coords = await getLocationWithRetry();
              const { deviceName, deviceId } = await getDeviceInfo();

              await sendPunch({
                type: "out",
                latitude: coords.latitude,
                longitude: coords.longitude,
                deviceName,
                deviceId,
              });

              // Hide the punch out button since they ended their shift
              setIsPunchedIn(false);
              await persistPunchStatus(false);
              if (onPunchStatusChange) onPunchStatusChange("out");
              Alert.alert("Success", `Punched out at ${new Date().toLocaleTimeString()}`);
            } catch (err) {
              Alert.alert("Error", err.message || "Could not record punch.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>{user.name}</Text>
        <Text style={styles.empId}>Emp Id : {user.employeeId}</Text>
      </View>

      {/* 1. Camera Box */}
      <TouchableOpacity style={styles.cameraContainer} onPress={capturePhoto}>
        {photoBase64 ? (
          <Image source={{ uri: photoBase64 }} style={styles.previewImage} />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraText}>📷 Tap to Capture Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.formContainer}>
        {/* 2. Category Radio Buttons */}
        <Text style={styles.label}>Work Category:-</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity 
            style={styles.radioOption} 
            onPress={() => {
              setSelectedCategory("personal");
              setSelectedWorkType(null); // Clear work type if personal is selected
            }}
          >
            <View style={styles.radioCircle}>
              {selectedCategory === "personal" && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioText}>Personal Work</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.radioOption} 
            onPress={() => setSelectedCategory("project")}
          >
            <View style={styles.radioCircle}>
              {selectedCategory === "project" && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioText}>Office Work</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Work Type Dropdown (Only shows if Office Work is selected) */}
        {selectedCategory === "project" && (
          <View style={styles.dropdownSection}>
            <Text style={styles.label}>Work Type:-</Text>
            <TouchableOpacity 
              style={styles.dropdownButton} 
              onPress={() => setWorkTypeModalVisible(true)}
            >
              <Text style={selectedWorkType ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                {selectedWorkType 
                  ? selectedWorkType.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())
                  : "Select Work Type"}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hourly Save Button */}
        {loading ? (
          <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 30 }} />
        ) : (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>SAVE</Text>
          </TouchableOpacity>
        )}

        {/* Punch Out Button - Only appears after the first successful SAVE */}
        {isPunchedIn && !loading && (
          <View style={styles.punchOutSection}>
            <View style={styles.divider} />
            <Text style={styles.punchOutLabel}>Done for the day?</Text>
            <TouchableOpacity style={styles.outBtn} onPress={handlePunchOut}>
              <Text style={styles.outBtnText}>PUNCH OUT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Dropdown Modal for Work Types */}
      <Modal visible={workTypeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select work type</Text>
            {workTypes.map((wt) => (
              <TouchableOpacity 
                key={wt} 
                style={styles.optionBtn} 
                onPress={() => {
                  setSelectedWorkType(wt);
                  setWorkTypeModalVisible(false);
                }}
              >
                <Text style={styles.optionText}>
                  {wt.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setWorkTypeModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#0f172a" },
  
  header: {
    backgroundColor: "#1e293b",
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  subtitle: { fontSize: 20, color: "#22c55e", fontWeight: "bold" },
  empId: { fontSize: 14, color: "#94a3b8", marginTop: 4 },

  cameraContainer: {
    height: 200,
    marginHorizontal: 20,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 24,
  },
  cameraPlaceholder: { alignItems: "center", justifyContent: "center" },
  cameraText: { color: "#94a3b8", fontSize: 16, fontWeight: "600" },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },

  formContainer: { paddingHorizontal: 24, paddingBottom: 40 },
  
  label: { fontSize: 18, fontWeight: "bold", color: "#f1f5f9", marginBottom: 16 },
  
  radioGroup: { flexDirection: "row", justifyContent: "space-around", marginBottom: 24 },
  radioOption: { flexDirection: "row", alignItems: "center" },
  radioCircle: {
    height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: "#22c55e",
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  radioDot: { height: 12, width: 12, borderRadius: 6, backgroundColor: "#22c55e" },
  radioText: { fontSize: 16, color: "#f1f5f9" },

  dropdownSection: { marginBottom: 24 },
  dropdownButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#22c55e", borderRadius: 12, padding: 16,
    backgroundColor: "#1e293b",
  },
  dropdownTextPlaceholder: { color: "#64748b", fontSize: 16 },
  dropdownTextSelected: { color: "#f1f5f9", fontSize: 16 },
  dropdownArrow: { color: "#22c55e", fontSize: 16 },

  saveBtn: { backgroundColor: "#22c55e", paddingVertical: 18, borderRadius: 30, alignItems: "center", marginTop: 10 },
  saveBtnText: { color: "white", fontWeight: "bold", fontSize: 18, letterSpacing: 1 },

  /* Punch Out Section */
  punchOutSection: { marginTop: 40, alignItems: "center" },
  divider: { height: 1, backgroundColor: "#334155", width: "100%", marginBottom: 20 },
  punchOutLabel: { color: "#94a3b8", fontSize: 14, marginBottom: 10 },
  outBtn: { backgroundColor: "transparent", borderWidth: 2, borderColor: "#ef4444", paddingVertical: 14, borderRadius: 30, alignItems: "center", width: "100%" },
  outBtnText: { color: "#ef4444", fontWeight: "bold", fontSize: 16, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: "#1e293b", borderRadius: 14, padding: 20 },
  modalTitle: { color: "#f1f5f9", fontSize: 17, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  optionBtn: { backgroundColor: "#0f172a", paddingVertical: 16, borderRadius: 10, marginBottom: 10, alignItems: "center" },
  optionText: { color: "#f1f5f9", fontSize: 15, fontWeight: "600" },
  cancelBtn: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: "#94a3b8", fontSize: 13 },
});