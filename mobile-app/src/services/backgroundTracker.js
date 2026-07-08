/**
 * Background location tracker.
 * Requires: npm install react-native-background-geolocation
 * (this is a paid-license library after a trial period — see note at bottom
 *  for a free alternative if budget is a concern)
 *
 * Triggers a location ping to the backend whichever happens FIRST:
 *   - 30 minutes pass, OR
 *   - the employee moves 1 km from their last recorded point
 * This matches real fleet-tracking behavior: frequent updates while moving,
 * periodic updates while stationary (so you always know they're still on shift).
 */
import BackgroundGeolocation from "react-native-background-geolocation";
import { sendPing } from "./api";

let currentEmployeeId = null;

export function initBackgroundTracking(employeeId) {
  currentEmployeeId = employeeId;

  BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,

    // Distance-based trigger: fires a location update once the employee
    // has moved 1000 meters (1 km) from the last recorded point.
    distanceFilter: 1000,

    // Time-based trigger (fallback for when they're stationary, e.g. sitting
    // at a desk or in a meeting): fires every 30 minutes regardless of movement.
    heartbeatInterval: 1800, // seconds

    stopTimeout: 5,
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

  // Fires when the employee moves >= distanceFilter (1km)
  BackgroundGeolocation.onLocation(async (location) => {
    try {
      await sendPing({
        employeeId: currentEmployeeId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log("Ping sent (1km movement trigger)");
    } catch (err) {
      console.log("Movement ping failed, will retry on next trigger:", err.message);
    }
  });

  // Fires on the heartbeatInterval (30 min) - covers stationary periods
  BackgroundGeolocation.onHeartbeat(async (event) => {
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({ persist: false });
      await sendPing({
        employeeId: currentEmployeeId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log("Ping sent (30 min heartbeat trigger)");
    } catch (err) {
      console.log("Heartbeat ping failed, will retry next interval:", err.message);
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
