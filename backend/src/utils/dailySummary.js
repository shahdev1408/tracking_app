const { totalDistanceKm, haversineKm } = require("./distance");

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDailySummary(pings, punches, ratePerKm = 0, startPoint = null, endPoint = null) {
  const dayMap = {};

  pings.forEach((p) => {
    const key = toDateKey(p.timestamp);
    if (!dayMap[key]) dayMap[key] = { pings: [], punches: [] };
    dayMap[key].pings.push(p);
  });

  punches.forEach((p) => {
    const key = toDateKey(p.timestamp);
    if (!dayMap[key]) dayMap[key] = { pings: [], punches: [] };
    dayMap[key].punches.push(p);
  });

  const summary = Object.keys(dayMap)
    .sort()
    .map((dateKey) => {
      const { pings: dayPings, punches: dayPunches } = dayMap[dateKey];

      dayPings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      dayPunches.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const allTimestamps = [
        ...dayPings.map((p) => new Date(p.timestamp)),
        ...dayPunches.map((p) => new Date(p.timestamp)),
      ].sort((a, b) => a - b);

      const firstActivity = allTimestamps[0] || null;
      const lastActivity = allTimestamps[allTimestamps.length - 1] || null;

      const punchIn = dayPunches.find((p) => p.type === "in");
      const punchOut = [...dayPunches].reverse().find((p) => p.type === "out");

      // Build one chronological route for the day out of pings + punches,
      // so travel between punches counts too, not just between pings.
      const mergedPoints = [
        ...dayPings.map((p) => ({
          latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp,
          billable: p.billable, placeName: p.placeName || null,
          deviceName: p.deviceName || null, deviceId: p.deviceId || null,
          kind: "ping",
        })),
        ...dayPunches.map((p) => ({
          latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp,
          billable: p.billable, placeName: p.placeName || null,
          deviceName: p.deviceName || null, deviceId: p.deviceId || null,
          kind: p.type === "in" ? "punch_in" : "punch_out",
        })),
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Prepend the manager-set Start Point (leaving-base leg) and append
      // the End Point (returning-to-base leg), if configured for this user.
      const hasStart = startPoint && typeof startPoint.latitude === "number" && typeof startPoint.longitude === "number";
      const hasEnd = endPoint && typeof endPoint.latitude === "number" && typeof endPoint.longitude === "number";

      const routeForDistance = [...mergedPoints];
      if (hasStart && routeForDistance.length) {
        routeForDistance.unshift({ latitude: startPoint.latitude, longitude: startPoint.longitude, billable: true, kind: "start_point" });
      }
      if (hasEnd && routeForDistance.length) {
        routeForDistance.push({ latitude: endPoint.latitude, longitude: endPoint.longitude, billable: true, kind: "end_point" });
      }

      const billablePoints = routeForDistance.filter((p) => p.billable);
      const personalPoints = routeForDistance.filter((p) => !p.billable);

      const billableKm = totalDistanceKm(billablePoints);
      const personalKm = totalDistanceKm(personalPoints);
      const totalKm = totalDistanceKm(routeForDistance);
      const pay = Number((billableKm * ratePerKm).toFixed(2));

      let cumulativeKm = 0;
      const routeWithDistance = routeForDistance.map((p, i) => {
        if (i > 0) {
          const prev = routeForDistance[i - 1];
          cumulativeKm += haversineKm(prev.latitude, prev.longitude, p.latitude, p.longitude);
        }
        return {
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp || null,
          billable: p.billable,
          placeName: p.placeName || null,
          cumulativeKm: Number(cumulativeKm.toFixed(2)),
          deviceName: p.deviceName || null,
          deviceId: p.deviceId || null,
          kind: p.kind,
        };
      });

      // autoPings is for the "Auto Track Points" list in the UI - real
      // ping records only, separate from the merged route (which also
      // includes punches and Start/End Point anchors for the map/km calc).
      let pingCumulativeKm = 0;
      const autoPingsWithDistance = dayPings.map((p, i) => {
        if (i > 0) {
          const prev = dayPings[i - 1];
          pingCumulativeKm += haversineKm(prev.latitude, prev.longitude, p.latitude, p.longitude);
        }
        return {
          _id: p._id,
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
          billable: p.billable,
          placeName: p.placeName || null,
          cumulativeKm: Number(pingCumulativeKm.toFixed(2)),
          deviceName: p.deviceName || null,
          deviceId: p.deviceId || null,
        };
      });

      return {
        date: dateKey,
        firstActivity,
        lastActivity,
        punchInTime: punchIn ? punchIn.timestamp : null,
        punchOutTime: punchOut ? punchOut.timestamp : null,
        totalKm: Number(totalKm.toFixed(2)),
        billableKm: Number(billableKm.toFixed(2)),
        personalKm: Number(personalKm.toFixed(2)),
        ratePerKm,
        pay,
        pingCount: dayPings.length,
        punchCount: dayPunches.length,
        manualPunches: dayPunches.map((p) => ({
          _id: p._id,
          type: p.type,
          timestamp: p.timestamp,
          latitude: p.latitude,
          longitude: p.longitude,
          placeName: p.placeName || null,
          billable: p.billable,
          punchCategory: p.punchCategory || null,
          workType: p.workType || null,
          photoBase64: p.photoBase64 || null,
          deviceName: p.deviceName || null,
          deviceId: p.deviceId || null,
        })),
        autoPings: autoPingsWithDistance,
        route: routeWithDistance,
      };
    });

  const totals = summary.reduce(
    (acc, d) => ({
      totalKm: acc.totalKm + d.totalKm,
      billableKm: acc.billableKm + d.billableKm,
      personalKm: acc.personalKm + d.personalKm,
      pay: acc.pay + d.pay,
    }),
    { totalKm: 0, billableKm: 0, personalKm: 0, pay: 0 }
  );
  totals.totalKm = Number(totals.totalKm.toFixed(2));
  totals.billableKm = Number(totals.billableKm.toFixed(2));
  totals.personalKm = Number(totals.personalKm.toFixed(2));
  totals.pay = Number(totals.pay.toFixed(2));

  return { days: summary, totals };
}

module.exports = { buildDailySummary, toDateKey };