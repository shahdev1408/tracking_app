import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, ActivityIndicator } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import {
  setAuthToken, getStoredUser, persistUser, clearSession, ensureAuthToken, getMyProfile,
} from './src/services/api';

// NOTE: session storage now goes through the helpers in services/api.js
// (setAuthToken/getStoredUser/persistUser/clearSession) instead of calling
// AsyncStorage directly here. This matters because backgroundTracker.js
// (the schedule-based auto-ping) also needs to read the same saved token
// when it wakes up in a fresh JS context - if App.js and the background
// task used different storage keys, the background schedule ping would
// never find a valid session.
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // On app start, check if we already have a saved login - if so, skip
  // straight to the Home screen instead of asking to log in again.
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const savedToken = await ensureAuthToken();
      const savedUser = await getStoredUser();
      if (!savedToken || !savedUser) {
        setCheckingSession(false);
        return;
      }

      // Confirm with the backend that the account still exists and hasn't
      // been disabled by the manager since the app was last open, rather
      // than blindly trusting what's saved on disk.
      const freshProfile = await getMyProfile();
      if (!freshProfile.active) {
        await clearSession();
        setCheckingSession(false);
        return;
      }

      await persistUser(freshProfile); // keep the stored copy up to date
      setUser(freshProfile);
    } catch (err) {
      console.log('Failed to restore session:', err.message);
      await clearSession();
    } finally {
      setCheckingSession(false);
    }
  }

  const handleLoginSuccess = async (loggedInUser, token) => {
    await setAuthToken(token);
    const freshProfile = await getMyProfile();
    await persistUser(freshProfile);
    setUser(freshProfile);
  };

  const handleLogout = async () => {
    await clearSession();
    setUser(null);
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />
      {user ? (
        <HomeScreen user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </SafeAreaView>
  );
}
