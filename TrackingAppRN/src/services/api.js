// Your live backend - already deployed and working
export const API_BASE_URL = "https://tracking-app-ps25.onrender.com";

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform, PermissionsAndroid } from 'react-native';

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

const OFFLINE_PUNCH_QUEUE_KEY = "offlinePunchQueue";

async function loadOfflinePunchQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PUNCH_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.log("Could not read offline punch queue:", err.message);
    return [];
  }
}

async function persistOfflinePunchQueue(queue) {
  try {
    await AsyncStorage.setItem(OFFLINE_PUNCH_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.log("Could not persist offline punch queue:", err.message);
  }
}

async function queuePunch(payload) {
  const queue = await loadOfflinePunchQueue();
  queue.push({ ...payload, createdAt: new Date().toISOString() });
  await persistOfflinePunchQueue(queue);
}

async function isConnected() {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  } catch (err) {
    console.log("Network status check failed:", err.message);
    return false;
  }
}

export async function uploadQueuedPunches() {
  const online = await isConnected();
  if (!online) return;

  await uploadQueuedPings().catch(console.log);

  await ensureAuthToken();
  const queue = await loadOfflinePunchQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/punch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (!res.ok) {
        console.log("Queued punch upload failed:", data.error || res.statusText);
        remaining.push(item);
      }
    } catch (err) {
      console.log("Queued punch upload error:", err.message);
      remaining.push(item);
    }
  }

  if (remaining.length !== queue.length) {
    await persistOfflinePunchQueue(remaining);
  }
}

export async function sendPunch({
  type, site, location, latitude, longitude,
  punchCategory, workType, photoBase64,
  transportMode, photoType,
  deviceName, deviceId,
}) {
  const payload = {
    type, site, location, latitude, longitude,
    punchCategory, workType, transportMode, photoType,
    photoBase64, deviceName, deviceId,
  };

  await ensureAuthToken();
  const online = await isConnected();
  if (!online) {
    await queuePunch(payload);
    return { queued: true, message: "Saved offline and will upload when connection returns." };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/punch`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status >= 500) {
        await queuePunch(payload);
        return { queued: true, message: "Server unavailable. Saved offline and will retry later." };
      }
      throw new Error(data.error || "Punch failed");
    }
    return data;
  } catch (err) {
    await queuePunch(payload);
    return { queued: true, message: "Network error. Saved offline and will upload later." };
  }
}

const OFFLINE_PING_QUEUE_KEY = "offlinePingQueue";

async function loadOfflinePingQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.log("Could not read offline ping queue:", err.message);
    return [];
  }
}

async function persistOfflinePingQueue(queue) {
  try {
    await AsyncStorage.setItem(OFFLINE_PING_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.log("Could not persist offline ping queue:", err.message);
  }
}

async function queuePing(payload) {
  const queue = await loadOfflinePingQueue();
  // Keep queue size manageable (max 200 pings)
  if (queue.length >= 200) queue.shift();
  queue.push({ ...payload, createdAt: new Date().toISOString() });
  await persistOfflinePingQueue(queue);
}

export async function uploadQueuedPings() {
  const online = await isConnected();
  if (!online) return;

  await ensureAuthToken();
  const queue = await loadOfflinePingQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tracking/ping`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (!res.ok && res.status >= 500) {
        remaining.push(item);
      }
    } catch (err) {
      remaining.push(item);
    }
  }

  if (remaining.length !== queue.length) {
    await persistOfflinePingQueue(remaining);
  }
}

export async function sendPing({ latitude, longitude, deviceName, deviceId, timestamp }) {
  let backgroundPermission = null;
  let batteryOptimizationStatus = "unknown";

  try {
    if (Platform.OS === 'android') {
      backgroundPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
      if (DeviceInfo && typeof DeviceInfo.isBatteryOptimizationEnabled === 'function') {
        const isOpt = await DeviceInfo.isBatteryOptimizationEnabled();
        batteryOptimizationStatus = isOpt ? "restricted" : "unrestricted";
      }
    }
  } catch (err) {
    batteryOptimizationStatus = "unknown";
  }

  const payload = {
    latitude,
    longitude,
    deviceName,
    deviceId,
    backgroundPermission,
    batteryOptimizationStatus,
    timestamp: timestamp || new Date().toISOString(),
  };

  const online = await isConnected();
  if (!online) {
    await queuePing(payload);
    return { queued: true, message: "Ping saved offline." };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/tracking/ping`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status >= 500) {
        await queuePing(payload);
        return { queued: true, message: "Ping saved offline due to server status." };
      }
      throw new Error(data.error || "Ping failed");
    }
    return data;
  } catch (err) {
    await queuePing(payload);
    return { queued: true, message: "Network error. Ping saved offline." };
  }
}

export async function checkAppUpdate() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/appVersion`);
    if (!res.ok) return null;
    return await res.json(); // { latestVersion, downloadUrl }
  } catch (err) {
    return null;
  }
}




