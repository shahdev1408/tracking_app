/**
 * Simple "update available" check - NOT silent/automatic OTA (that would
 * need a paid service like CodePush, which Microsoft has shut down for
 * free tier). Instead: on app launch, ask the backend what the latest
 * version is; if the installed version is older, show an alert with a
 * direct download link for the new APK. No auto-install - user still taps
 * the link and installs manually, but they never need you to explain it
 * to them again.
 *
 * Requires a backend endpoint (added in this update): GET /api/app-version
 * returning { latestVersion: "1.2.0", downloadUrl: "https://..." }
 */
import { Alert, Linking } from "react-native";
import { API_BASE_URL } from "../services/api";

// Bump this string every time you release a new build.
export const CURRENT_APP_VERSION = "1.1.0";

function isNewer(latest, current) {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const a = l[i] || 0;
    const b = c[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

export async function checkForAppUpdate() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/app-version`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.latestVersion) return;

    if (isNewer(data.latestVersion, CURRENT_APP_VERSION)) {
      Alert.alert(
        "Update Available",
        `A newer version (${data.latestVersion}) is available. Please update to continue getting the latest features.`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Download",
            onPress: () => data.downloadUrl && Linking.openURL(data.downloadUrl),
          },
        ]
      );
    }
  } catch (err) {
    console.log("App version check failed:", err.message);
  }
}
