import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import LoadingIndicator from '../utils/LoadingIndicator';

export default function VerificationScreen({ phoneNumber, onBack, onVerified }) {
  const { verifyCode, sendVerificationCode, phoneVerification } = useAuth();
  const [code, setCode] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const inputRefs = useRef([]);

  // Start countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Auto-verify when code is complete
  useEffect(() => {
    if (code.length === 6) {
      handleVerifyCode();
    }
  }, [code]);

  const handleCodeChange = (value, index) => {
    const newCode = code.split('');
    newCode[index] = value;
    const updatedCode = newCode.join('');
    setCode(updatedCode);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code');
      return;
    }

    const result = await verifyCode(phoneNumber, code);
    
    if (result.success) {
      setVerificationSuccess(true);
      
      // Show success for 2 seconds before transitioning
      setTimeout(() => {
        if (onVerified) {
          onVerified(result.user);
        }
      }, 2000);
    } else {
      Alert.alert(
        'Invalid Code',
        result.error || 'The verification code is incorrect. Please try again.'
      );
      setCode('');
      // Focus first input
      inputRefs.current[0]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    const result = await sendVerificationCode(phoneNumber);
    
    if (result.success) {
      setResendTimer(60);
      setCanResend(false);
      setCode('');
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
    } else {
      Alert.alert('Error', result.error || 'Failed to resend code. Please try again.');
    }
  };

  // Format phone number for display
  const formatPhoneForDisplay = (phone) => {
    if (phone.startsWith('+33')) {
      const number = phone.slice(3);
      return `+33 ${number.slice(0, 1)} ${number.slice(1, 3)} ${number.slice(3, 5)} ${number.slice(5, 7)} ${number.slice(7)}`;
    }
    return phone;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color="#6b7280" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🔐</Text>
            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.phoneNumber}>{formatPhoneForDisplay(phoneNumber)}</Text>
            </Text>
          </View>

          {/* Success Display */}
          {verificationSuccess && (
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <MaterialIcons name="check-circle" size={64} color="#10b981" />
              </View>
              <Text style={styles.successTitle}>Verification Successful!</Text>
              <Text style={styles.successMessage}>
                Welcome to Voilà! Setting up your account...
              </Text>
              <View style={styles.successLoadingContainer}>
                <LoadingIndicator size="small" />
              </View>
            </View>
          )}

          {/* Code Input - Hide when success */}
          {!verificationSuccess && (
            <>
              {/* Code Input */}
              <View style={styles.codeContainer}>
                {[...Array(6)].map((_, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                      styles.codeInput,
                      code[index] && styles.codeInputFilled,
                      phoneVerification.error && styles.codeInputError
                    ]}
                    value={code[index] || ''}
                    onChangeText={(value) => handleCodeChange(value, index)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              {/* Error Display */}
              {phoneVerification.error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{phoneVerification.error}</Text>
                </View>
              )}

              {/* Loading Indicator */}
              {phoneVerification.isLoading && (
                <View style={styles.loadingContainer}>
                  <LoadingIndicator size="small" />
                  <Text style={styles.loadingText}>Verifying code...</Text>
                </View>
              )}

              {/* Resend Section */}
              <View style={styles.resendSection}>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
                
                {canResend ? (
                  <TouchableOpacity onPress={handleResendCode}>
                    <Text style={styles.resendButton}>Resend Code</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendTimer}>
                    Resend code in {resendTimer}s
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#374151',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  codeInputFilled: {
    borderColor: '#6366f1',
    backgroundColor: '#f8faff',
  },
  codeInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  resendButton: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  resendTimer: {
    fontSize: 14,
    color: '#9ca3af',
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 40,
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  successLoadingContainer: {
    marginTop: 10,
  },
}); 