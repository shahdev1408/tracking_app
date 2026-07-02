import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import Geolocation from "react-native-geolocation-service";
import { sendPunch } from "../services/api";

// Replace with real logged-in employee ID (from login/auth flow)
const EMPLOYEE_ID = "EMP001";

export default function PunchInScreen() {
  const [loading, setLoading] = useState(false);
  const [lastPunch, setLastPunch] = useState(null);

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
      const coords = await getCurrentLocation();
      const result = await sendPunch({
        employeeId: EMPLOYEE_ID,
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
      <Text style={styles.subtitle}>Employee: {EMPLOYEE_ID}</Text>

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
});
