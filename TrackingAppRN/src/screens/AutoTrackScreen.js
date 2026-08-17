import { useEffect, useRef } from "react";
import { Platform, PermissionsAndroid, AppState } from "react-native";
import Geolocation from "react-native-geolocation-service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendPing, getMyProfile } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const LAST_SCHEDULED_PING_KEY = "lastScheduledPingAt";
const CACHED_SCHEDULE_KEY = "cachedAutoSchedule";

// How often we re-fetch the employee's schedule from the server (5 min).
// Between fetches we use the cached copy so we never miss a ping cycle
// just because the API was slow.
const PROFILE_REFRESH_MS = 5 * 60 * 1000;

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

async function getLastPingTime() {
  try {
    const lastStr = await AsyncStorage.getItem(LAST_SCHEDULED_PING_KEY);
    if (!lastStr) return 0;
    return new Date(lastStr).getTime();
  } catch (err) {
    return 0;
  }
}

async function markScheduledPingSent() {
  try {
    await AsyncStorage.setItem(LAST_SCHEDULED_PING_KEY, new Date().toISOString());
  } catch (err) {
    console.log("Could not record last scheduled ping time:", err.message);
  }
}

async function cacheSchedule(schedule) {
  try {
    await AsyncStorage.setItem(CACHED_SCHEDULE_KEY, JSON.stringify(schedule));
  } catch (err) { /* ignore */ }
}

async function getCachedSchedule() {
  try {
    const raw = await AsyncStorage.getItem(CACHED_SCHEDULE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export default function AutoTrackScreen({ user }) {
  const timerRef = useRef(null);
  const scheduleRef = useRef(null);  // cached schedule in memory
  const lastProfileFetchRef = useRef(0);
  const isSendingRef = useRef(false); // prevent overlapping sends

  async function requestLocationPermission() {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        { title: "Allow Location", message: "Allow Location", buttonPositive: "Allow" }
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

  // Refresh the schedule from server, but only every PROFILE_REFRESH_MS.
  // In between, use the in-memory / AsyncStorage cached copy.
  async function refreshScheduleIfNeeded() {
    const now = Date.now();
    if (now - lastProfileFetchRef.current < PROFILE_REFRESH_MS && scheduleRef.current) {
      return scheduleRef.current;
    }
    try {
      const profile = await getMyProfile();
      if (!profile || !profile.active) {
        scheduleRef.current = null;
        return null;
      }
      scheduleRef.current = profile.autoSchedule || null;
      lastProfileFetchRef.current = now;
      if (scheduleRef.current) await cacheSchedule(scheduleRef.current);
      return scheduleRef.current;
    } catch (err) {
      console.log("Could not fetch profile, using cache:", err.message);
      // Fall back to cached schedule so we don't skip pings
      if (!scheduleRef.current) {
        scheduleRef.current = await getCachedSchedule();
      }
      return scheduleRef.current;
    }
  }

  // The core "tick" — called precisely on interval.
  async function tick() {
    if (isSendingRef.current) return; // already sending, skip
    try {
      isSendingRef.current = true;
      const schedule = await refreshScheduleIfNeeded();
      if (!schedule) return;
      if (!isWithinScheduledWindow(schedule)) return;

      const intervalMs = (schedule.intervalMinutes || 30) * 60 * 1000;
      const lastPingMs = await getLastPingTime();
      const elapsed = Date.now() - lastPingMs;

      if (elapsed < intervalMs - 5000) return; // 5s tolerance

      const coords = await getCurrentLocation();
      const { deviceName, deviceId } = await getDeviceInfo();
      await sendPing({ latitude: coords.latitude, longitude: coords.longitude, deviceName, deviceId });
      await markScheduledPingSent();
      console.log("Foreground schedule ping sent at", new Date().toLocaleTimeString());
    } catch (err) {
      console.log("Schedule tick failed:", err.message);
    } finally {
      isSendingRef.current = false;
    }
  }

  // Compute how many ms until the next ping is due, then set a precise
  // setTimeout for exactly that moment. This avoids the "poll every 60s
  // and hope we land on it" approach which drifts.
  async function scheduleNextTick() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const schedule = scheduleRef.current || await getCachedSchedule();
    if (!schedule || !schedule.enabled) {
      // No schedule yet — check again in 30s in case manager sets one
      timerRef.current = setTimeout(() => scheduleNextTick(), 30000);
      return;
    }

    const intervalMs = (schedule.intervalMinutes || 30) * 60 * 1000;
    const lastPingMs = await getLastPingTime();
    const elapsed = Date.now() - lastPingMs;
    // How long until the next ping is due?
    let delayMs = Math.max(intervalMs - elapsed, 0);

    // Cap minimum delay to 5 seconds (don't fire immediately in rapid loop)
    if (delayMs < 5000 && lastPingMs > 0) delayMs = 5000;
    // If never pinged, fire immediately
    if (lastPingMs === 0) delayMs = 1000;

    console.log(`Next foreground ping in ${Math.round(delayMs / 1000)}s`);

    timerRef.current = setTimeout(async () => {
      await tick();
      // After firing, schedule the next one
      scheduleNextTick();
    }, delayMs);
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission || !isMounted) return;

      // Load cached schedule first so we have it immediately
      scheduleRef.current = await getCachedSchedule();
      // Then try a fresh fetch
      await refreshScheduleIfNeeded();
      // Fire immediately if due
      await tick();
      // Then set up the precise timer chain
      scheduleNextTick();
    }

    init();

    // When app comes back to foreground, recalculate timer immediately
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isMounted) {
        console.log("App returned to foreground — recalculating ping timer");
        tick().then(() => scheduleNextTick());
      }
    });

    return () => {
      isMounted = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      subscription.remove();
    };
  }, []);

  return null;
}
