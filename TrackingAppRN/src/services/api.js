// Your live backend - already deployed and working
export const API_BASE_URL = "https://tracking-app-ps25.onrender.com";

import AsyncStorage from "@react-native-async-storage/async-storage";

let authToken = null;

export async function setAuthToken(token) {
  authToken = token;
  try {
    await AsyncStorage.setItem("authToken", token || "");
  } catch (err) {
    console.log("Could not persist auth token:", err.message);
  }
}

export function getAuthToken() {
  return authToken;
}

// Background/headless tasks run in a brand-new JS context (the app may be
// fully closed), so the in-memory `authToken` above is empty there. This
// loads it back from storage before making any authenticated call.
export async function ensureAuthToken() {
  if (authToken) return authToken;
  try {
    const stored = await AsyncStorage.getItem("authToken");
    if (stored) authToken = stored;
  } catch (err) {
    console.log("Could not read stored auth token:", err.message);
  }
  return authToken;
}

// Keeps the logged-in user's basic info (employeeId/name/role) on disk so
// the app can skip the login screen on next open. Paired with the token
// above - both are cleared together on logout.
export async function persistUser(user) {
  try {
    await AsyncStorage.setItem("authUser", JSON.stringify(user));
  } catch (err) {
    console.log("Could not persist user:", err.message);
  }
}

const PUNCH_STATUS_KEY = "isPunchedIn";

export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem("authUser");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export async function persistPunchStatus(isPunchedIn) {
  try {
    await AsyncStorage.setItem(PUNCH_STATUS_KEY, isPunchedIn ? "true" : "false");
  } catch (err) {
    console.log("Could not persist punch status:", err.message);
  }
}

export async function getStoredPunchStatus() {
  try {
    const raw = await AsyncStorage.getItem(PUNCH_STATUS_KEY);
    return raw === "true";
  } catch (err) {
    return false;
  }
}

export async function clearPunchStatus() {
  try {
    await AsyncStorage.removeItem(PUNCH_STATUS_KEY);
  } catch (err) {
    console.log("Could not clear punch status:", err.message);
  }
}

export async function clearSession() {
  authToken = null;
  try {
    await AsyncStorage.multiRemove(["authToken", "authUser"]);
    await clearPunchStatus();
  } catch (err) {
    console.log("Could not clear stored session:", err.message);
  }
}

function authHeaders() {
  return authToken
    ? { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }
    : { "Content-Type": "application/json" };
}

// ---------- Auth ----------

export async function registerUser({ employeeId, name, phone, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, name, phone, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data; // { message, token, user }
}

// deviceName/deviceId are sent so the dashboard shows which phone logged in
export async function loginUser({ employeeId, password, deviceName, deviceId }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password, deviceName, deviceId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data; // { message, token, user }
}

// Full profile including active status + autoSchedule - used to sync the
// schedule-based auto-tracking without needing the app open.
export async function getMyProfile() {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load profile");
  return data.user;
}

// ---------- Punch / Tracking (require login) ----------

export async function sendPunch({
  type, site, location, latitude, longitude,
  punchCategory, workType, photoBase64, deviceName, deviceId,
}) {
  const res = await fetch(`${API_BASE_URL}/api/punch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      type, site, location, latitude, longitude,
      punchCategory, workType, photoBase64, deviceName, deviceId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Punch failed");
  return data;
}

import { Platform, PermissionsAndroid } from 'react-native';

export async function sendPing({ latitude, longitude, deviceName, deviceId }) {
  let backgroundPermission = null;
  try {
    if (Platform.OS === 'android') {
      // ACCESS_BACKGROUND_LOCATION may not be available on older SDKs — wrap safely
      backgroundPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
    }
  } catch (err) {
    backgroundPermission = null;
  }

  const res = await fetch(`${API_BASE_URL}/api/tracking/ping`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ latitude, longitude, deviceName, deviceId, backgroundPermission }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ping failed");
  return data;
}