import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from '../components/Toast';
import { TYPOGRAPHY } from '../theme/typography';

export default function LoginScreen({
  onLogin,
  onGoToSignup,
  onForgotPassword,
  onBack,
  onGuestMode,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBackToHome = onBack || onGuestMode;

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await onLogin({ email: email.trim(), password });
    } catch (error) {
      setErrorMessage(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <Toast message={errorMessage} type="error" onDismiss={() => setErrorMessage('')} />
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.authScreen}
          contentContainerStyle={styles.authContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authContainer}>
          {/* Back to Home Button */}
          {handleBackToHome ? (
            <View style={styles.cardTopRow}>
              <Pressable
                style={styles.backButton}
                onPress={handleBackToHome}
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
              >
                <Ionicons name="chevron-back" size={20} color="#0F172A" />
              </Pressable>
            </View>
          ) : null}

          {/* Brand Logo Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/bhagira_logo_brand.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>BHAGIRA</Text>
            <Text style={styles.brandSubtitle}>Clean Water at Your Doorstep</Text>
          </View>

          {/* Form Header */}
          <View style={styles.titleWrap}>
            <Text style={styles.authTitle}>Welcome Back</Text>
            <Text style={styles.authSubtitle}>
              Sign in with your registered account to continue
            </Text>
          </View>

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabelText}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={19} color="#64748B" style={styles.inputLeftIcon} />
              <TextInput
                style={styles.inputWithIcons}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>
          </View>

          {/* Password Field with Eye Toggle */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabelText}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={19} color="#64748B" style={styles.inputLeftIcon} />
              <TextInput
                style={styles.inputWithIcons}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
              />
              <Pressable
                style={styles.eyeIconButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </Pressable>
            </View>
          </View>

          {/* Forgot Password Link */}
          <Pressable style={styles.linkButton} onPress={onForgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>

          {/* Primary Sign In Button */}
          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </Pressable>

          {/* Signup Link */}
          <View style={styles.footerRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Pressable onPress={onGoToSignup}>
              <Text style={styles.createAccountLink}>Create account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>
);
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EDF3F9',
  },
  authScreen: {
    width: '100%',
    flex: 1,
  },
  authContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 280,
  },
  authContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#0751A8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 18,
    color: '#0751A8',
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  brandSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 22,
    color: '#0F172A',
    fontWeight: '800',
    marginBottom: 6,
  },
  authSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabelText: {
    ...TYPOGRAPHY.inputLabel,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
  },
  inputLeftIcon: {
    marginRight: 10,
  },
  inputWithIcons: {
    flex: 1,
    height: '100%',
    ...TYPOGRAPHY.inputValue,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  eyeIconButton: {
    padding: 6,
    marginLeft: 4,
  },
  linkButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    fontWeight: '700',
    color: '#0751A8',
  },
  primaryButton: {
    backgroundColor: '#0751A8',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 22,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: '#64748B',
  },
  createAccountLink: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    fontWeight: '700',
    color: '#0751A8',
  },
});
