// Your live backend - already deployed and working
export const API_BASE_URL = "https://tracking-app-ps25.onrender.com";

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
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

export async function loginUser({ employeeId, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data; // { message, token, user }
}

// ---------- Punch / Tracking (require login) ----------

export async function sendPunch({ type, site, location, latitude, longitude }) {
  const res = await fetch(`${API_BASE_URL}/api/punch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type, site, location, latitude, longitude }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Punch failed");
  return data;
}

export async function sendPing({ latitude, longitude }) {
  const res = await fetch(`${API_BASE_URL}/api/tracking/ping`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ latitude, longitude }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ping failed");
  return data;
}
