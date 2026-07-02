/**
 * Business rules for whether a location point is "billable" (company pays)
 * or "personal" (employee's own time/travel, not compensated).
 *
 * Rule 1: Sunday travel = personal (not billable), regardless of time.
 * Rule 2: Travel within office hours on other days = billable.
 * Rule 3: Travel outside office hours on non-Sunday days = NOT billable
 *         (adjust this if your company pays for early/late travel too).
 */

function isSunday(date) {
  return date.getDay() === 0; // 0 = Sunday in JS Date
}

function isWithinOfficeHours(date, startTime = "09:30", endTime = "18:30") {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const start = new Date(date);
  start.setHours(startH, startM, 0, 0);

  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);

  return date >= start && date <= end;
}

function evaluatePoint(timestamp, officeStartTime, officeEndTime) {
  const date = new Date(timestamp);
  const sunday = isSunday(date);
  const officeHours = isWithinOfficeHours(date, officeStartTime, officeEndTime);

  // Billable only if NOT Sunday AND within office hours
  const billable = !sunday && officeHours;

  return { isSunday: sunday, isOfficeHours: officeHours, billable };
}

module.exports = { isSunday, isWithinOfficeHours, evaluatePoint };
