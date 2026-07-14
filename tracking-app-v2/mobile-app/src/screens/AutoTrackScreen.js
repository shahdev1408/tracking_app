import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, PermissionsAndroid, Platform } from "react-native";
import Geolocation from "react-native-geolocation-service";
import { sendPing } from "../services/api";

const DISTANCE_TRIGGER_METERS = 1000; // 1 km moved
const TIME_TRIGGER_MS = 10 * 60 * 1000; // 10 minutes passed while app is open (foreground safety net)

// Auto-tracking ONLY runs while `active` is true - which HomeScreen sets
// based on whether the employee is currently punched in. Punch In starts
// this, Punch Out stops it completely (no lingering pings after work ends).
export default function AutoTrackScreen({ user, active }) {
  const [lastAutoPing, setLastAutoPing] = useState(null);
  const [pingCountThisSession, setPingCountThisSession] = useState(0);
  const watchIdRef = useRef(null);
  const timeCheckIntervalRef = useRef(null);
  const lastPingTimeRef = useRef(Date.now());

  async function requestLocationPermission() {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "This app needs your location to automatically track site visits.",
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

  async function sendAutoPing(latitude, longitude) {
    try {
      await sendPing({ latitude, longitude });
      lastPingTimeRef.current = Date.now();
      setLastAutoPing(new Date());
      setPingCountThisSession((c) => c + 1);
    } catch (err) {
      console.log("Auto-ping failed:", err.message);
    }
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timeCheckIntervalRef.current) {
      clearInterval(timeCheckIntervalRef.current);
      timeCheckIntervalRef.current = null;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function start() {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission || !isMounted) return;

      try {
        const coords = await getCurrentLocation();
        await sendAutoPing(coords.latitude, coords.longitude);
      } catch (err) {
        console.log("Initial location fetch failed:", err.message);
      }

      watchIdRef.current = Geolocation.watchPosition(
        (pos) => sendAutoPing(pos.coords.latitude, pos.coords.longitude),
        (err) => console.log("watchPosition error:", err.message),
        { enableHighAccuracy: true, distanceFilter: DISTANCE_TRIGGER_METERS, interval: 10000, fastestInterval: 5000 }
      );

      timeCheckIntervalRef.current = setInterval(async () => {
        if (Date.now() - lastPingTimeRef.current >= TIME_TRIGGER_MS) {
          try {
            const coords = await getCurrentLocation();
            await sendAutoPing(coords.latitude, coords.longitude);
          } catch (err) {
            console.log("Time-trigger ping failed:", err.message);
          }
        }
      }, 60000);
    }

    if (active) {
      start();
    } else {
      stopTracking();
    }

    return () => {
      isMounted = false;
      stopTracking();
    };
  }, [active]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Automatic Tracking</Text>
      <Text style={styles.subtitle}>{user.name} ({user.employeeId})</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: active ? "#22c55e" : "#64748b" }]} />
          <Text style={styles.statusText}>{active ? "Active" : "Waiting for Punch In"}</Text>
        </View>

        {active ? (
          <>
            <Text style={styles.detailText}>
              Sends your location automatically whenever you move 1 km, or every 10 minutes if you stay in one place.
            </Text>
            <Text style={styles.detailText}>
              Also runs in the background every ~15 min if you minimize the app.
            </Text>
            {lastAutoPing && (
              <Text style={styles.lastUpdate}>Last update: {lastAutoPing.toLocaleTimeString()}</Text>
            )}
            <Text style={styles.countText}>Auto points sent this session: {pingCountThisSession}</Text>
          </>
        ) : (
          <Text style={styles.detailText}>
            Go to the "Manual Punch" tab and tap Punch In to start automatic tracking for the day. It will stop automatically when you Punch Out.
          </Text>
        )}
      </View>

      <Text style={styles.footerNote}>
        You don't need to do anything on this screen — it works automatically once you're punched in.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f1f5f9", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 4, marginBottom: 24 },
  statusCard: { backgroundColor: "#1e293b", borderRadius: 12, padding: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: "#f1f5f9", fontSize: 16, fontWeight: "bold" },
  detailText: { color: "#94a3b8", fontSize: 13, marginBottom: 6, lineHeight: 18 },
  lastUpdate: { color: "#22c55e", fontSize: 13, marginTop: 8, fontWeight: "bold" },
  countText: { color: "#64748b", fontSize: 12, marginTop: 4 },
  footerNote: { color: "#64748b", fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 16 },
});
