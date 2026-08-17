/**
 * Real background location tracking - fires even when the app is minimized.
 *
 * Uses `react-native-background-fetch` (free, MIT licensed) instead of the
 * paid react-native-background-geolocation library. Trade-off: Android only
 * allows background tasks to run a MINIMUM of every 15 minutes (this is an
 * OS-level restriction, not something any library can bypass) - so the
 * background WAKE-UP itself is every ~15 min no matter what. The schedule's
 * "Ping every X minutes" setting works on top of that: every time we wake
 * up, we check how long it's been since the last successful ping and skip
 * unless at least X minutes have passed. That means:
 *   - X = 15 (or less): pings every wake-up, i.e. every ~15 min - the
 *     practical minimum on Android; X < 15 can't be honored exactly.
 *   - X = 30/60/120/180: skips wake-ups until that much time has passed,
 *     so it works exactly as set.
 *
 * NEW: schedule-based tracking. Every time this task runs, it first checks
 * the employee's `autoSchedule` (set by the manager on the dashboard - days
 * + start time + end time + interval). If the current day/time falls
 * inside that window, it pings (subject to the interval above) -
 * completely independent of whether the employee has manually punched in.
 *
 * IMPORTANT REAL-WORLD NOTE: Some phone brands (Xiaomi, Oppo, Vivo, OnePlus)
 * aggressively kill background apps to save battery. If tracking stops working
 * after a while on those phones, the employee needs to manually disable
 * "battery optimization" for this app:
 *   Settings -> Apps -> [This App] -> Battery -> Unrestricted / No restrictions
 * This is a known Android manufacturer quirk affecting all tracking/delivery
 * apps, not something we can fix from code alone.
 */
import BackgroundFetch from "react-native-background-fetch";
import Geolocation from "react-native-geolocation-service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendPing, uploadQueuedPunches, getMyProfile, ensureAuthToken, getStoredPunchStatus } from "./api";
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
    return true; // if we can't tell, err on the side of pinging
  }
}

async function markScheduledPingSent() {
  try {
    await AsyncStorage.setItem(LAST_SCHEDULED_PING_KEY, new Date().toISOString());
  } catch (err) {
    console.log("Could not record last scheduled ping time:", err.message);
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
    console.log("Background fetch: ping sent successfully");
  } catch (err) {
    console.log("Background fetch: failed to get location/send ping:", err.message);
  }
}

async function runBackgroundCheck() {
  await ensureAuthToken();
  await uploadQueuedPunches();

  try {
    const profile = await getMyProfile();
    if (!profile || !profile.active) return;
    const schedule = profile.autoSchedule;
    if (!isWithinScheduledWindow(schedule)) return;

    const canPingNow = await enoughTimeHasPassed(schedule.intervalMinutes);
    if (!canPingNow) return;

    await getLocationAndPing();
    await markScheduledPingSent();
  } catch (err) {
    console.log("Background fetch: could not check schedule:", err.message);
  }
}

let alreadyConfigured = false;

export function initBackgroundFetch(user) {
  // Guard against configure() running more than once if HomeScreen ever
  // remounts (e.g. logout -> login again in the same app session).
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
      await runBackgroundCheck(false);
      BackgroundFetch.finish(taskId);
    },
    (error) => {
      console.log("Background fetch failed to configure:", error);
    }
  );
}

// Registers the headless task - must be called exactly ONCE, at app
// startup, from index.js (NOT from inside a component/useEffect). Calling
// it from a component causes the "registerHeadlessTask called multiple
// times for same key 'BackgroundFetch'" warning, since the component can
// mount more than once during the app's lifetime (e.g. logout -> login).
export function registerBackgroundHeadlessTask() {
  BackgroundFetch.registerHeadlessTask(async (event) => {
    await runBackgroundCheck(false);
    BackgroundFetch.finish(event.taskId);
  });
}

export function stopBackgroundFetch() {
  BackgroundFetch.stop();
}