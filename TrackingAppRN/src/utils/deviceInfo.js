/**
 * Device identification for anti-misuse tracking on the dashboard.
 *
 * IMPORTANT: True IMEI is NOT accessible to apps since Android 10 (API 29) -
 * Google removed it for privacy, and there is no workaround, permission,
 * or library that restores it. What we use instead:
 *
 *  - deviceName: human-readable model, e.g. "Samsung Galaxy M31"
 *  - deviceId:   DeviceInfo.getUniqueId() - a per-app-install identifier
 *                that stays stable for the app's lifetime on that device.
 *                Not the IMEI, but serves the same "which phone was this
 *                punch made from" purpose for your dashboard.
 *
 * Requires: npm install react-native-device-info
 */
import DeviceInfo from "react-native-device-info";

let cachedInfo = null;

export async function getDeviceInfo() {
  if (cachedInfo) return cachedInfo;
  try {
    const deviceName = await DeviceInfo.getModel(); // e.g. "Galaxy M31"
    const brand = DeviceInfo.getBrand(); // e.g. "samsung"
    const deviceId = await DeviceInfo.getUniqueId();
    cachedInfo = {
      deviceName: `${brand} ${deviceName}`.trim(),
      deviceId,
    };
    return cachedInfo;
  } catch (err) {
    console.log("Could not read device info:", err.message);
    return { deviceName: "Unknown device", deviceId: "unknown" };
  }
}
