import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, PermissionsAndroid } from "react-native";
import { loginUser, registerUser } from "../services/api";
import { getDeviceInfo } from "../utils/deviceInfo";
import { checkForAppUpdate } from "../utils/appVersion";
import { useLanguage, LANGUAGE_OPTIONS } from "../utils/language";

export default function LoginScreen({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  // Check once when the login screen first opens, so even logged-out
  // users get nudged to update.
  useEffect(() => {
    checkForAppUpdate();
  }, []);

  async function requestLocationPermissions() {
    if (Platform.OS !== 'android') return true;

    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: t('allowLocation'),
        message: t('locationPermissionNeeded'),
        buttonPositive: t('allow'),
        buttonNegative: t('cancel'),
      }
    );

    if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(t('permissionRequired'), t('locationPermissionNeeded'));
      return false;
    }

    const background = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: t('allowLocation'),
        message: t('backgroundPermissionNeeded'),
        buttonPositive: t('allow'),
        buttonNegative: t('cancel'),
      }
    );

    if (background !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(t('permissionRequired'), t('backgroundPermissionNeeded'));
    }

    return true;
  }

  const handleSubmit = async () => {
    if (!employeeId || !password || (isRegisterMode && !name)) {
      Alert.alert(t('missingInfo'), t('fillAllFields'));
      return;
    }
    setLoading(true);
    try {
      const { deviceName, deviceId } = await getDeviceInfo();

      const result = isRegisterMode
        ? await registerUser({ employeeId, name, password })
        : await loginUser({ employeeId, password, deviceName, deviceId });

        const permissionGranted = await requestLocationPermissions();
        if (!permissionGranted) {
          Alert.alert(t('permissionRequired'), t('locationPermissionNeeded'));
        }

        onLoginSuccess(result.user, result.token);
    } catch (err) {
      Alert.alert(isRegisterMode ? "Registration failed" : "Login failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.languageSection}>
        <Text style={styles.languageLabel}>{t('selectLanguage')}</Text>
        <View style={styles.languageButtons}>
          {LANGUAGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.code}
              style={[
                styles.languageButton,
                language === option.code && styles.languageButtonActive,
              ]}
              onPress={() => setLanguage(option.code)}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  language === option.code && styles.languageButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.title}>{isRegisterMode ? t('createAccount') : t('employeeLogin')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('employeeId')}
        placeholderTextColor="#64748b"
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="none"
      />

      {isRegisterMode && (
        <TextInput
          style={styles.input}
          placeholder={t('fullName')}
          placeholderTextColor="#64748b"
          value={name}
          onChangeText={setName}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder={t('password')}
        placeholderTextColor="#64748b"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{isRegisterMode ? t('register') : t('logIn')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => setIsRegisterMode(!isRegisterMode)} style={{ marginTop: 16 }}>
        <Text style={styles.switchText}>
          {isRegisterMode ? t('alreadyHaveAccount') : t('newEmployeeRegister')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f1f5f9", textAlign: "center", marginBottom: 30 },
  input: {
    backgroundColor: "#1e293b", color: "#f1f5f9", padding: 14, borderRadius: 10,
    marginBottom: 12, fontSize: 15,
  },
  languageSection: { marginBottom: 20 },
  languageLabel: { color: "#f1f5f9", marginBottom: 10, fontSize: 14, fontWeight: '600' },
  languageButtons: { flexDirection: "row", justifyContent: "space-between" },
  languageButton: {
    flex: 1,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  languageButtonActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  languageButtonText: { color: "#f1f5f9", fontSize: 14 },
  languageButtonTextActive: { color: "#0f172a", fontWeight: "700" },
  button: { backgroundColor: "#22c55e", padding: 16, borderRadius: 10, alignItems: "center", marginTop: 8 },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  switchText: { color: "#60a5fa", textAlign: "center", fontSize: 13 },
});
