import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  PermissionsAndroid, Platform, Linking, Image, ScrollView
} from "react-native";
import Geolocation from "react-native-geolocation-service";
import { launchCamera } from "react-native-image-picker";
import { sendPunch, persistPunchStatus, getStoredPunchStatus } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";
import { useLanguage } from "../utils/language";

export default function ManualPunchScreen({ user, onPunchStatusChange }) {
  const [loading, setLoading] = useState(false);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const { t } = useLanguage();

  const [selectedTransportMode, setSelectedTransportMode] = useState(null);
  const [photoStartBase64, setPhotoStartBase64] = useState(null);
  const [photoEndBase64, setPhotoEndBase64] = useState(null);

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

  async function requestLocationPermission() {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: t('allowLocation'),
          message: t('locationPermissionNeeded'),
          buttonPositive: t('allow'),
          buttonNegative: t('cancel'),
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
            t('locationOffTitle'),
            t('locationOffMessage'),
            [
              { text: t('cancel'), style: "cancel", onPress: () => reject(err) },
              {
                text: t('openSettings'),
                onPress: () => {
                  if (Platform.OS === "android") {
                    Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
                  }
                  reject(err);
                },
              },
              {
                text: t('retry'),
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

  async function capturePhoto(slot) {
    launchCamera(
      { mediaType: "photo", saveToPhotos: false, cameraType: "back", quality: 0.6, maxWidth: 1024, maxHeight: 1024, includeBase64: true },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert(t('cameraError'), response.errorMessage || t('failedOpenCamera'));
          return;
        }
        const asset = response.assets && response.assets[0];
        if (!asset || !asset.base64) {
            Alert.alert(t('errorTitle'), t('noPhotoCaptured'));
          return;
        }

        if (asset.fileSize && asset.fileSize < 5000) {
          Alert.alert(
              t('unclearPhotoTitle'),
              t('unclearPhoto'),
              [{ text: t('retake'), onPress: () => capturePhoto(slot) }]
          );
          return;
        }

        const uri = `data:image/jpeg;base64,${asset.base64}`;
        if (slot === "start") setPhotoStartBase64(uri);
        else setPhotoEndBase64(uri);
      }
    );
  }

  const getPhotoPlaceholder = (slot) => {
    if (selectedTransportMode === "personal_vehicle") {
      return slot === "start"
        ? t('captureStartOdometer')
        : t('captureEndOdometer');
    }
    if (selectedTransportMode === "public_transport") {
      return slot === "start"
        ? t('captureTicketMorning')
        : t('captureTicketEvening');
    }
    if (selectedTransportMode === "office_vehicle") {
      return slot === "start"
        ? t('captureOfficeVehiclePhoto')
        : t('captureOfficeVehiclePhoto');
    }
    return slot === "start" ? t('captureStart') : t('captureEnd');
  }
  async function handleStart() {
    if (!selectedTransportMode) {
      Alert.alert(t('validationTitle'), t('validationTransportMode'));
      return;
    }
    if (!photoStartBase64) {
      Alert.alert(t('validationTitle'), t('validationStartPhoto'));
      return;
    }

    setLoading(true);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(t('permissionRequired'), t('locationPermissionNeeded'));
        setLoading(false);
        return;
      }

      const coords = await getLocationWithRetry();
      const { deviceName, deviceId } = await getDeviceInfo();

      const result = await sendPunch({
        type: "in",
        latitude: coords.latitude,
        longitude: coords.longitude,
        transportMode: selectedTransportMode,
        photoType: "start",
        photoBase64: photoStartBase64,
        deviceName,
        deviceId,
      });

      setIsPunchedIn(true);
      await persistPunchStatus(true);
      if (onPunchStatusChange) onPunchStatusChange("in");
      Alert.alert(
        t('successStarted'),
        result?.queued
          ? t('offlineSavedMessage')
          : `${t('successStarted')} ${new Date().toLocaleTimeString()}`
      );
    } catch (err) {
      Alert.alert(t('errorTitle'), err.message || t('errorRecordStart'));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnd() {
    if (!selectedTransportMode) {
      Alert.alert(t('validationTitle'), t('validationTransportMode'));
      return;
    }
    if (!photoEndBase64) {
      Alert.alert(t('validationTitle'), t('validationEndPhoto'));
      return;
    }

    setLoading(true);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(t('permissionRequired'), t('locationPermissionNeeded'));
        setLoading(false);
        return;
      }

      const coords = await getLocationWithRetry();
      const { deviceName, deviceId } = await getDeviceInfo();

      const result = await sendPunch({
        type: "out",
        latitude: coords.latitude,
        longitude: coords.longitude,
        transportMode: selectedTransportMode,
        photoType: "end",
        photoBase64: photoEndBase64,
        deviceName,
        deviceId,
      });

      setIsPunchedIn(false);
      await persistPunchStatus(false);
      if (onPunchStatusChange) onPunchStatusChange("out");
      Alert.alert(
        t('successEnded'),
        result?.queued
          ? t('offlineSavedMessage')
          : `${t('successEnded')} ${new Date().toLocaleTimeString()}`
      );

      setPhotoStartBase64(null);
      setPhotoEndBase64(null);
      setSelectedTransportMode(null);
    } catch (err) {
      Alert.alert(t('errorTitle'), err.message || t('errorRecordEnd'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{user.name}</Text>
        <Text style={styles.empId}>Emp Id : {user.employeeId}</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>{t('modeOfTransport')}</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setSelectedTransportMode("personal_vehicle")}
          >
            <View style={styles.radioCircle}>
              {selectedTransportMode === "personal_vehicle" && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioText}>{t('personalVehicle')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setSelectedTransportMode("public_transport")}
          >
            <View style={styles.radioCircle}>
              {selectedTransportMode === "public_transport" && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioText}>{t('publicTransport')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setSelectedTransportMode("office_vehicle")}
          >
            <View style={styles.radioCircle}>
              {selectedTransportMode === "office_vehicle" && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.radioText}>{t('officeVehicle')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.instructionText}>
          {selectedTransportMode
            ? t('photoInstructionsSelected')
            : t('photoInstructionsDefault')
          }
        </Text>

        <View style={styles.photoRow}>
          <View style={styles.photoBox}>
            <Text style={styles.photoLabel}>{t('start')} ({t('morning')})</Text>
            <TouchableOpacity style={styles.cameraContainer} onPress={() => capturePhoto("start")}>
              {photoStartBase64 ? (
                <Image source={{ uri: photoStartBase64 }} style={styles.previewImage} />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Text style={styles.cameraText}>{getPhotoPlaceholder("start")}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.photoBox}>
            <Text style={styles.photoLabel}>{t('end')} ({t('evening')})</Text>
            <TouchableOpacity style={styles.cameraContainer} onPress={() => capturePhoto("end")}>
              {photoEndBase64 ? (
                <Image source={{ uri: photoEndBase64 }} style={styles.previewImage} />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Text style={styles.cameraText}>{getPhotoPlaceholder("end")}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 30 }} />
        ) : (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleStart}
            disabled={isPunchedIn}
          >
            <Text style={styles.saveBtnText}>{t('start')}</Text>
          </TouchableOpacity>
        )}

        {isPunchedIn && !loading && (
          <View style={styles.punchOutSection}>
            <View style={styles.divider} />
            <Text style={styles.punchOutLabel}>{t('readyToEndDay')}</Text>
            <TouchableOpacity style={styles.outBtn} onPress={handleEnd}>
              <Text style={styles.outBtnText}>{t('end')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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

  formContainer: { paddingHorizontal: 24, paddingBottom: 40 },

  label: { fontSize: 18, fontWeight: "bold", color: "#f1f5f9", marginBottom: 16 },

  radioGroup: { marginBottom: 24 },
  radioOption: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  radioCircle: {
    height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: "#22c55e",
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  radioDot: { height: 12, width: 12, borderRadius: 6, backgroundColor: "#22c55e" },
  radioText: { fontSize: 16, color: "#f1f5f9" },

  photoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 24 },
  photoBox: { flex: 1 },
  photoLabel: { color: "#94a3b8", marginBottom: 10, fontSize: 14 },
  instructionText: { color: "#cbd5e1", fontSize: 13, marginBottom: 16, lineHeight: 20 },
  cameraContainer: {
    height: 170,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  cameraPlaceholder: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  cameraText: { color: "#94a3b8", fontSize: 15, fontWeight: "600", textAlign: "center" },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },

  saveBtn: { backgroundColor: "#22c55e", paddingVertical: 18, borderRadius: 30, alignItems: "center", marginTop: 10 },
  saveBtnText: { color: "white", fontWeight: "bold", fontSize: 18, letterSpacing: 1 },

  punchOutSection: { marginTop: 40, alignItems: "center" },
  divider: { height: 1, backgroundColor: "#334155", width: "100%", marginBottom: 20 },
  punchOutLabel: { color: "#94a3b8", fontSize: 14, marginBottom: 10 },
  outBtn: { backgroundColor: "transparent", borderWidth: 2, borderColor: "#ef4444", paddingVertical: 14, borderRadius: 30, alignItems: "center", width: "100%" },
  outBtnText: { color: "#ef4444", fontWeight: "bold", fontSize: 16, letterSpacing: 1 },
});