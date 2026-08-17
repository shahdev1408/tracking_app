/**
 * Real background location tracking - fires even when the app is minimized.
 *
 * Uses `react-native-background-fetch` (free, MIT licensed).
 *
 * STRATEGY:
 * 1. BackgroundFetch.configure() gives us a periodic wake-up every ~15 min.
 *    This is the MINIMUM Android OS allows — it is NOT a precise timer;
 *    Android batches and delays these for battery savings.
 *
 * 2. To get MORE PRECISE pings, we ALSO schedule one-shot tasks using
 *    BackgroundFetch.scheduleTask() with a `delay` set to the exact number
 *    of milliseconds until the next ping is due. Android honours one-shot
 *    tasks more precisely than periodic ones. We chain them: after each
 *    ping fires, we schedule the next one-shot.
 *
 * 3. Schedule (days, startTime, endTime, intervalMinutes) is set by the
 *    manager on the dashboard. Tracking is 100% independent of Punch
 *    In / Punch Out.
 *
 * IMPORTANT REAL-WORLD NOTE: Some phone brands (Xiaomi, Oppo, Vivo, OnePlus)
 * aggressively kill background apps to save battery. If tracking stops on
 * those phones, the employee needs to disable "battery optimization":
 *   Settings -> Apps -> [This App] -> Battery -> Unrestricted
 */
import BackgroundFetch from "react-native-background-fetch";
import Geolocation from "react-native-geolocation-service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendPing, uploadQueuedPunches, getMyProfile, ensureAuthToken } from "./api";
import { getDeviceInfo } from "../utils/deviceInfo";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const LAST_SCHEDULED_PING_KEY = "lastScheduledPingAt";
const CACHED_SCHEDULE_KEY = "cachedAutoSchedule";

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

async function getLocationAndPing() {
  try {
    const coords = await new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
      );
    });
    const { deviceName, deviceId } = await getDeviceInfo();
    await sendPing({ latitude: coords.latitude, longitude: coords.longitude, deviceName, deviceId });
    console.log("Background ping sent at", new Date().toLocaleTimeString());
  } catch (err) {
    console.log("Background fetch: failed to get location/send ping:", err.message);
  }
}

// Schedule a one-shot background task that will fire after `delayMs`
// milliseconds. Android honours one-shot tasks more precisely than
// periodic ones.
function scheduleOneShotTask(delayMs) {
  const delaySec = Math.max(Math.round(delayMs / 1000), 60); // min 60s
  console.log(`Scheduling one-shot background task in ${delaySec}s`);
  BackgroundFetch.scheduleTask({
    taskId: "com.mmipl.track.scheduled-ping",
    delay: delaySec * 1000, // ms
    periodic: false,
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
    requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
  }).catch(err => console.log("Failed to schedule one-shot task:", err));
}

async function runBackgroundCheck() {
  await ensureAuthToken();
  await uploadQueuedPunches();

  let schedule = null;
  try {
    const profile = await getMyProfile();
    if (!profile || !profile.active) return;
    schedule = profile.autoSchedule;
    if (schedule) await cacheSchedule(schedule);
  } catch (err) {
    console.log("Background: could not fetch profile, using cache:", err.message);
    schedule = await getCachedSchedule();
  }

  if (!schedule || !isWithinScheduledWindow(schedule)) return;

  const intervalMs = (schedule.intervalMinutes || 30) * 60 * 1000;
  const lastPingMs = await getLastPingTime();
  const elapsed = Date.now() - lastPingMs;

  if (elapsed < intervalMs - 5000) {
    // Not time yet — schedule a precise one-shot for the remaining time
    const remaining = intervalMs - elapsed;
    scheduleOneShotTask(remaining);
    return;
  }

  // Time to ping!
  await getLocationAndPing();
  await markScheduledPingSent();

  // Chain: schedule the NEXT one-shot for exactly intervalMs from now
  scheduleOneShotTask(intervalMs);
}

let alreadyConfigured = false;

export function initBackgroundFetch(user) {
  if (alreadyConfigured) return;
  alreadyConfigured = true;

  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async (taskId) => {
      console.log("BackgroundFetch event:", taskId, "at", new Date().toLocaleTimeString());
      await runBackgroundCheck();
      BackgroundFetch.finish(taskId);
    },
    (error) => {
      console.log("Background fetch failed to configure:", error);
    }
  );

  // Also schedule an initial one-shot to start the precise chain
  (async () => {
    let schedule = null;
    try {
      const profile = await getMyProfile();
      schedule = profile?.autoSchedule;
      if (schedule) await cacheSchedule(schedule);
    } catch (e) {
      schedule = await getCachedSchedule();
    }
    if (schedule && schedule.enabled) {
      const intervalMs = (schedule.intervalMinutes || 30) * 60 * 1000;
      const lastPingMs = await getLastPingTime();
      const elapsed = Date.now() - lastPingMs;
      const remaining = Math.max(intervalMs - elapsed, 60000);
      scheduleOneShotTask(remaining);
    }
  })();
}

export function registerBackgroundHeadlessTask() {
  BackgroundFetch.registerHeadlessTask(async (event) => {
    console.log("Headless event:", event.taskId, "at", new Date().toLocaleTimeString());
    await runBackgroundCheck();
    BackgroundFetch.finish(event.taskId);
  });
}

export function stopBackgroundFetch() {
  BackgroundFetch.stop();
}