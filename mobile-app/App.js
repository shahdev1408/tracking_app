import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import PunchInScreen from './src/screens/PunchInScreen';
import { setAuthToken } from './src/services/api';

export default function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (loggedInUser, token) => {
    setAuthToken(token);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />
      {user ? (
        <PunchInScreen user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </SafeAreaView>
  );
}
