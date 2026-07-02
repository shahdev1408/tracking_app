# Tracking App Backend

Node.js + Express + MongoDB API for employee location tracking, punch-in,
and km-based compensation calculation.

## Setup
1. Install [Node.js](https://nodejs.org) and [MongoDB](https://www.mongodb.com/try/download/community) (or use MongoDB Atlas free tier — easier, no local install).
2. ```
   cd backend
   npm install
   cp .env.example .env
   ```
3. Edit `.env` and set `MONGO_URI` (local Mongo or your Atlas connection string).
4. ```
   npm start
   ```
   Server runs at `http://localhost:5000`

## Business rules (already implemented in `src/utils/payRules.js`)
- **Sunday** → never billable (personal travel), regardless of time.
- **Office hours** (default 09:30–18:30, configurable per employee) on non-Sunday → billable.
- Outside office hours on a weekday → not billable (adjust in `payRules.js` if your company pays for early/late travel too).

## API Endpoints

### Punch in/out
```
POST /api/punch
Body: { employeeId, type: "in"|"out", site, location, latitude, longitude, timestamp? }

GET /api/punch/:employeeId?from=2026-07-01&to=2026-07-31
```

### Background tracking ping (called every 30 min from mobile app)
```
POST /api/tracking/ping
Body: { employeeId, latitude, longitude, timestamp? }

GET /api/tracking/:employeeId?from=2026-07-01&to=2026-07-31
```

### Reports (km + compensation split)
```
GET /api/reports/km/:employeeId?from=2026-07-01&to=2026-07-31
Returns: { totalKm, billableKm, personalKm, ... }
```

## Testing without a mobile app (use curl or Postman)
```bash
curl -X POST http://localhost:5000/api/tracking/ping \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP001","latitude":22.7788,"longitude":73.6142}'

curl http://localhost:5000/api/reports/km/EMP001
```

## Next steps
- Add authentication (JWT) so only the employee's own app / admin can submit data.
- Add an Employee record for each staff member (`src/models/Employee.js`) with their `officeStartTime`/`officeEndTime` if it varies by person.
- Deploy to a free host (Render, Railway) + MongoDB Atlas free tier for a working online version.
