import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ResetPasswordScreen({ onResetPassword, onBackToLogin }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <View style={styles.authScreen}>
      <View style={styles.authContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>🔒</Text>
        </View>
        <Text style={styles.authTitle}>Reset password</Text>
        <Text style={styles.authSubtitle}>Create a new password for your account</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabelText}>New password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter new password"
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabelText}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => onResetPassword(password, confirmPassword)}>
          <Text style={styles.primaryButtonText}>Update password</Text>
        </Pressable>

        <Text style={styles.signupText}>
          Want to go back? <Text style={styles.linkText} onPress={onBackToLogin}>Login</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  authContainer: {
    width: '100%',
    maxWidth: 520,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#f1f9ff',
  },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: '#dff7ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  logoText: {
    fontSize: 38,
  },
  authTitle: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 26,
  },
  inputGroup: {
    marginBottom: 18,
  },
  fieldLabelText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#dbeaf5',
    fontSize: 15,
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  signupText: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
    marginTop: 24,
  },
  linkText: {
    color: '#0ea5e9',
    fontWeight: '700',
  },
});
