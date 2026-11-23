import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function VendorLoginScreen({ onLogin, onBackToLogin }) {
  return (
    <View style={styles.authScreen}>
      <View style={styles.authContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>💧</Text>
        </View>

        <Text style={styles.authTitle}>Vendor Login</Text>
        <Text style={styles.authSubtitle}>Access your dispatch dashboard, orders and delivery progress.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabelText}>Vendor email</Text>
          <TextInput style={styles.input} value="vendor@waterflow.in" editable={false} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabelText}>Password</Text>
          <TextInput style={styles.input} value="••••••••" secureTextEntry editable={false} />
        </View>

        <Pressable style={styles.primaryButton} onPress={onLogin}>
          <Text style={styles.primaryButtonText}>Login to dashboard</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onBackToLogin}>
          <Text style={styles.secondaryButtonText}>Back to user login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef7ff',
  },
  authContainer: {
    width: '100%',
    maxWidth: 390,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
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
    marginBottom: 22,
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
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#10b981',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeaf5',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
