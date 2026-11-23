import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function OtpVerificationScreen({ onVerifyOtp, onBackToLogin, onResendOtp }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const handleChange = (value, index) => {
    const nextOtp = [...otp];
    nextOtp[index] = value.replace(/\D/g, '').slice(0, 1);
    setOtp(nextOtp);

    if (value && index < otp.length - 1) {
      const nextInput = `otp-${index + 1}`;
      if (globalThis?.document) {
        const input = document.getElementById(nextInput);
        if (input) input.focus();
      }
    }
  };

  return (
    <View style={styles.authScreen}>
      <View style={styles.authContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>📲</Text>
        </View>
        <Text style={styles.authTitle}>Verify OTP</Text>
        <Text style={styles.authSubtitle}>Enter the 6-digit code sent to your email</Text>

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              id={`otp-${index}`}
              value={digit}
              onChangeText={(value) => handleChange(value, index)}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <Pressable style={styles.primaryButton} onPress={() => onVerifyOtp(otp.join(''))}>
          <Text style={styles.primaryButtonText}>Verify</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onResendOtp}>
          <Text style={styles.secondaryButtonText}>Resend OTP</Text>
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
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  otpInput: {
    width: 42,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeaf5',
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#dbeaf5',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 15,
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
