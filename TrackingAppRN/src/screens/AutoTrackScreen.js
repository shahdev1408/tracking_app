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
import { useEffect, useRef } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import Geolocation from "react-native-geolocation-service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendPing, getMyProfile } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const LAST_SCHEDULED_PING_KEY = "lastScheduledPingAt";

function isWithinScheduledWindow(schedule) {
  if (!schedule || !schedule.enabled) return false;
  const now = new Date();
  const todayName = DAY_NAMES[now.getDay()];
  if (!schedule.days || !schedule.days.includes(todayName)) return false;

  const [startH, startM] = (schedule.startTime || "08:00").split(":").map(Number);
  const [endH, endM] = (schedule.endTime || "20:00").split(":").map(Number);

  const start = new Date(now); start.setHours(startH, startM, 0, 0);
  const end = new Date(now); end.setHours(endH, endM, 0, 0);

  return now >= start && now <= end;
}

async function enoughTimeHasPassed(intervalMinutes) {
  try {
    const lastStr = await AsyncStorage.getItem(LAST_SCHEDULED_PING_KEY);
    if (!lastStr) return true;
    const last = new Date(lastStr).getTime();
    const minutesSince = (Date.now() - last) / 60000;
    return minutesSince >= (intervalMinutes || 30);
  } catch (err) {
    return true;
  }
}

async function markScheduledPingSent() {
  try {
    await AsyncStorage.setItem(LAST_SCHEDULED_PING_KEY, new Date().toISOString());
  } catch (err) {
    console.log("Could not record last scheduled ping time:", err.message);
  }
}

export default function AutoTrackScreen({ user }) {
  const checkIntervalRef = useRef(null);

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

  async function checkScheduleAndPing() {
    try {
      const profile = await getMyProfile();
      if (!profile || !profile.active) return;
      const schedule = profile.autoSchedule;
      if (!isWithinScheduledWindow(schedule)) return;

      const canPingNow = await enoughTimeHasPassed(schedule.intervalMinutes);
      if (!canPingNow) return;

      const coords = await getCurrentLocation();
      const { deviceName, deviceId } = await getDeviceInfo();
      await sendPing({ latitude: coords.latitude, longitude: coords.longitude, deviceName, deviceId });
      await markScheduledPingSent();
      console.log("Schedule ping sent successfully");
    } catch (err) {
      console.log("Schedule check failed:", err.message);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission || !isMounted) return;

      await checkScheduleAndPing();

      // Check schedule window every 60 seconds. Ping only fires when interval has elapsed.
      checkIntervalRef.current = setInterval(() => {
        checkScheduleAndPing();
      }, 60000);
    }

    init();

    return () => {
      isMounted = false;
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, []);

  return null;
}
