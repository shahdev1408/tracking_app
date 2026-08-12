/**
 * Haversine formula: calculates straight-line distance (in km) between
 * two lat/long points on Earth's surface.
 * Note: this is straight-line distance, not actual road distance.
 * For road-accurate distance, swap this for Google Distance Matrix API later.
 */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Given an array of {latitude, longitude, timestamp} points sorted by time,
 * sums the distance between consecutive points with noise filtering to prevent
 * stationary GPS drift (ignoring < 30m jumps) and impossible speed glitches (> 150 km/h).
 */
function totalDistanceKm(points) {
  let total = 0;
  let lastValid = points[0];

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    if (!lastValid || curr.latitude == null || curr.longitude == null) continue;

    const dist = haversineKm(lastValid.latitude, lastValid.longitude, curr.latitude, curr.longitude);
    
    // Ignore stationary jitter under 30 meters (0.03 km)
    if (dist < 0.03) continue;

    // Speed sanity check if timestamps are present (ignore > 150 km/h impossible jumps)
    if (lastValid.timestamp && curr.timestamp) {
      const timeDiffHours = (new Date(curr.timestamp).getTime() - new Date(lastValid.timestamp).getTime()) / (3600 * 1000);
      if (timeDiffHours > 0) {
        const speed = dist / timeDiffHours;
        if (speed > 150) continue; // Skip teleportation / GPS glitch
      }
    }

    total += dist;
    lastValid = curr;
  }
  return total;
}

module.exports = { haversineKm, totalDistanceKm };
