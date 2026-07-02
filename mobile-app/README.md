# Tracking App — Mobile (React Native)

Employee-facing app: manual punch-in/out + automatic background location
pings every 30 minutes.

## Setup

1. Install React Native environment (one-time): follow the official guide
   for your OS — https://reactnative.dev/docs/environment-setup
   (choose "React Native CLI Quickstart", not Expo, since background
   tracking needs native modules Expo doesn't support well).

2. ```
   cd mobile-app
   npm install
   ```

3. **Set your backend URL** in `src/services/api.js` — change
   `API_BASE_URL` to your computer's LAN IP (for local testing) or your
   deployed backend URL.

4. Run on Android:
   ```
   npm run android
   ```
   Run on iOS (Mac only, needs Xcode):
   ```
   npm run ios
   ```

## Permissions you must add

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

**iOS** (`ios/YourApp/Info.plist`):
```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We track your location during work hours to calculate site-visit compensation.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

Without these, background tracking will silently fail or the app will be
rejected from app stores.

## Important cost note

`react-native-background-geolocation` (used in `src/services/backgroundTracker.js`)
is free to develop with, but requires a **paid license (~$349 one-time per app)**
for production/app-store release — it's the most reliable option for true
background tracking on both platforms.

**Free alternative:** `react-native-background-fetch` +
`react-native-geolocation-service` — works but is less precise about exact
30-min timing (OS may delay it) and needs more manual battery-optimization
handling. Let me know if you'd like me to swap the code to this free version
instead.

## Still pending
- Login/auth screen (currently `EMPLOYEE_ID` is hardcoded for testing)
- History screen showing past punches/km travelled (pulls from `/api/reports/km/:employeeId`)
