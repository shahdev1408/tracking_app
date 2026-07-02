// Change this to your deployed backend URL when ready.
// For local testing on a real phone, use your computer's LAN IP, not "localhost".
export const API_BASE_URL = "http://192.168.1.100:5000";

export async function sendPunch({ employeeId, type, site, location, latitude, longitude }) {
  const res = await fetch(`${API_BASE_URL}/api/punch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, type, site, location, latitude, longitude }),
  });
  if (!res.ok) throw new Error("Punch failed: " + (await res.text()));
  return res.json();
}

export async function sendPing({ employeeId, latitude, longitude }) {
  const res = await fetch(`${API_BASE_URL}/api/tracking/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, latitude, longitude }),
  });
  if (!res.ok) throw new Error("Ping failed: " + (await res.text()));
  return res.json();
}
