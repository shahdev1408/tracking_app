import React, { useEffect } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import PunchInScreen from "./src/screens/PunchInScreen";
import { initBackgroundTracking } from "./src/services/backgroundTracker";

const EMPLOYEE_ID = "EMP001"; // replace with real logged-in employee ID

export default function App() {
  useEffect(() => {
    // Starts the 30-min background ping as soon as the app is opened.
    // Location permission must be granted first (handle that in a login/onboarding screen).
    initBackgroundTracking(EMPLOYEE_ID);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <StatusBar barStyle="light-content" />
      <PunchInScreen />
    </SafeAreaView>
  );
}
