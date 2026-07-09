import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { loginUser, registerUser, setAuthToken } from "../services/api";

export default function LoginScreen({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!employeeId || !password || (isRegisterMode && !name)) {
      Alert.alert("Missing info", "Please fill all fields.");
      return;
    }
    setLoading(true);
    try {
      const result = isRegisterMode
        ? await registerUser({ employeeId, name, password })
        : await loginUser({ employeeId, password });

      setAuthToken(result.token);
      onLoginSuccess(result.user, result.token);
    } catch (err) {
      Alert.alert(isRegisterMode ? "Registration failed" : "Login failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isRegisterMode ? "Create Account" : "Employee Login"}</Text>

      <TextInput
        style={styles.input}
        placeholder="Employee ID (e.g. EMP001)"
        placeholderTextColor="#64748b"
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="none"
      />

      {isRegisterMode && (
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#64748b"
          value={name}
          onChangeText={setName}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{isRegisterMode ? "Register" : "Log In"}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => setIsRegisterMode(!isRegisterMode)} style={{ marginTop: 16 }}>
        <Text style={styles.switchText}>
          {isRegisterMode ? "Already have an account? Log In" : "New employee? Register here"}
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
  button: { backgroundColor: "#22c55e", padding: 16, borderRadius: 10, alignItems: "center", marginTop: 8 },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  switchText: { color: "#60a5fa", textAlign: "center", fontSize: 13 },
});
