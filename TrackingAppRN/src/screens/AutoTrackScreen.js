import { useEffect, useRef } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import Geolocation from "react-native-geolocation-service";
import { sendPing } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";

// Foreground (app open) tracking cadence. These are kept aggressive so the
// admin dashboard's "live" view feels near-real-time (like WhatsApp live
// location) while the employee's app is open:
//   - ping after every 50m moved (smooth route, catches most movement)
//   - always ping at least once every 60s as a safety net, so even a
//     stationary employee still sends a fresh "I'm here" signal.
// NOTE: this only applies while the app is foregrounded. When the app is
// closed/background, Android OS caps background wake-ups at ~15 min (see
// backgroundTracker.js), so real-time freshness is only achievable while
// the app is open.
const DISTANCE_TRIGGER_METERS = 50;
const TIME_TRIGGER_MS = 60 * 1000;

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
          title: "Allow Location",
          message: "Allow Location",
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
