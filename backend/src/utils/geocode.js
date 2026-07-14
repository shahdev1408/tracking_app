/**
 * Converts latitude/longitude into a human-readable place name using
 * OpenStreetMap's free Nominatim reverse geocoding service.
 *
 * IMPORTANT: Nominatim's free usage policy allows max 1 request/second and
 * requires a descriptive User-Agent. This is fine for our volume (a few
 * punches/pings per employee per day), but if you ever scale to hundreds of
 * employees pinging every few minutes, you'll need a paid geocoding service
 * (Google Geocoding API, Mapbox, etc.) instead.
 */
async function reverseGeocode(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TrackingAppRN/1.0 (internal company use)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch (err) {
    console.log("Reverse geocode failed:", err.message);
    return null; // never block a punch/ping just because geocoding failed
  }
}

module.exports = { reverseGeocode };
