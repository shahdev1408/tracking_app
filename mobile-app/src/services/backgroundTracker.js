/**
 * Background location tracker.
 * Requires: npm install react-native-background-geolocation
 * (this is a paid-license library after a trial period — see note at bottom
 *  for a free alternative if budget is a concern)
 *
 * This pings the backend every 30 minutes with the employee's current
 * location, even when the app is closed or the phone is locked.
 */
import BackgroundGeolocation from "react-native-background-geolocation";
import { sendPing } from "./api";

let currentEmployeeId = null;

export function initBackgroundTracking(employeeId) {
  currentEmployeeId = employeeId;

  BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 0,          // don't filter by distance, we want time-based pings
    stopTimeout: 5,
    // Time-based tracking: fire every 30 minutes (1800000 ms)
    heartbeatInterval: 1800,     // seconds
    stopOnTerminate: false,      // keep tracking after app is force-closed (Android)
    startOnBoot: true,           // resume tracking after phone restart
    foregroundService: true,     // required on Android 8+ for reliable background tracking
    notification: {
      title: "Location tracking active",
      text: "Tracking your site visits for compensation calculation",
    },
  }, (state) => {
    if (!state.enabled) {
      BackgroundGeolocation.start();
    }
  });

  // Fires on the heartbeatInterval defined above
  BackgroundGeolocation.onHeartbeat(async (event) => {
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({ persist: false });
      await sendPing({
        employeeId: currentEmployeeId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log("Background ping sent successfully");
    } catch (err) {
      console.log("Background ping failed, will retry next interval:", err.message);
    }
  });
}

export function stopBackgroundTracking() {
  BackgroundGeolocation.stop();
}

/**
 * NOTE on cost: react-native-background-geolocation is free for development
 * but requires a paid license for production apps. If budget is tight, the
 * free alternative is `react-native-background-fetch` + `react-native-geolocation-service`,
 * which is less battery-optimized but works for this use case. Let me know
 * if you'd like that version instead — happy to swap it in.
 */
