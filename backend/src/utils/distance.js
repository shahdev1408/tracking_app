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
 * sums the distance between consecutive points to get total km travelled.
 */
function totalDistanceKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    total += haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  return total;
}

module.exports = { haversineKm, totalDistanceKm };
