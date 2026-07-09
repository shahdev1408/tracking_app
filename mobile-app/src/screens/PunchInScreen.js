import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, PermissionsAndroid, Platform } from "react-native";
import Geolocation from "react-native-geolocation-service";
import { sendPunch } from "../services/api";

export default function PunchInScreen({ user, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [lastPunch, setLastPunch] = useState(null);

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

  const handlePunch = async (type) => {
    setLoading(true);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert("Permission Required", "Location permission is needed to punch in/out.");
        setLoading(false);
        return;
      }

      const coords = await getCurrentLocation();
      const result = await sendPunch({
        type,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setLastPunch(result.punch);
      Alert.alert("Success", `Punched ${type} at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      Alert.alert("Error", err.message || "Could not record punch. Check location permission and network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Site Visit Tracker</Text>
      <Text style={styles.subtitle}>{user.name} ({user.employeeId})</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.inButton]} onPress={() => handlePunch("in")}>
            <Text style={styles.buttonText}>Punch In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.outButton]} onPress={() => handlePunch("out")}>
            <Text style={styles.buttonText}>Punch Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {lastPunch && (
        <View style={styles.lastPunchBox}>
          <Text style={styles.lastPunchLabel}>Last punch:</Text>
          <Text style={styles.lastPunchText}>
            {lastPunch.type.toUpperCase()} at {new Date(lastPunch.timestamp).toLocaleString()}
          </Text>
          <Text style={styles.lastPunchText}>
            Billable: {lastPunch.billable ? "Yes" : "No (Sunday or off-hours)"}
          </Text>
        </View>
      )}

      <TouchableOpacity onPress={onLogout} style={{ marginTop: 30 }}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f1f5f9", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 4, marginBottom: 30 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  button: { flex: 1, paddingVertical: 18, borderRadius: 10, alignItems: "center" },
  inButton: { backgroundColor: "#22c55e" },
  outButton: { backgroundColor: "#ef4444" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  lastPunchBox: { marginTop: 30, padding: 16, backgroundColor: "#1e293b", borderRadius: 10 },
  lastPunchLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 4 },
  lastPunchText: { color: "#f1f5f9", fontSize: 14 },
  logoutText: { color: "#f87171", textAlign: "center", fontSize: 13 },
});
