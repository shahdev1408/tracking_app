import React, { useEffect, useRef } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import Geolocation from "react-native-geolocation-service";
import { sendPing } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";

const DISTANCE_TRIGGER_METERS = 300; // fires every 300m moved for a smoother, more accurate route
const TIME_TRIGGER_MS = 10 * 60 * 1000; // 10 minutes passed while app is open (foreground safety net)

// This screen no longer renders any UI - the employee should not see or
// know that automatic tracking exists as a separate feature. It still runs
// exactly as before: starts on Punch In, stops on Punch Out, keeps sending
// pings in the background while `active` is true. Mounted invisibly by
// HomeScreen regardless of which tab (if any) is showing.
export default function AutoTrackScreen({ user, active }) {
  const watchIdRef = useRef(null);
  const timeCheckIntervalRef = useRef(null);
  const lastPingTimeRef = useRef(Date.now());

  async function requestLocationPermission() {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "This app needs your location to work correctly. Please allow location access.",
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
      const { deviceName, deviceId } = await getDeviceInfo();
      await sendPing({ latitude, longitude, deviceName, deviceId });
      lastPingTimeRef.current = Date.now();
    } catch (err) {
      // Location-off (code 2) or network errors just get logged and
      // retried on the next trigger - we never stop the whole tracking
      // loop over one failed ping (e.g. GPS was briefly off).
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
        console.log("Initial location fetch failed (location may be off):", err.message);
      }

      watchIdRef.current = Geolocation.watchPosition(
        (pos) => sendAutoPing(pos.coords.latitude, pos.coords.longitude),
        (err) => console.log("watchPosition error (location may be off):", err.message),
        { enableHighAccuracy: true, distanceFilter: DISTANCE_TRIGGER_METERS, interval: 10000, fastestInterval: 5000 }
      );

      timeCheckIntervalRef.current = setInterval(async () => {
        if (Date.now() - lastPingTimeRef.current >= TIME_TRIGGER_MS) {
          try {
            const coords = await getCurrentLocation();
            await sendAutoPing(coords.latitude, coords.longitude);
          } catch (err) {
            console.log("Time-trigger ping failed (location may be off):", err.message);
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

  return null;
}
