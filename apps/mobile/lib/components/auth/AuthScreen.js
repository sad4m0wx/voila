import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from '../core/PhoneInput';
import LoadingIndicator from '../utils/LoadingIndicator';
import { GradientView } from '../core';
import { GRADIENT_STYLES } from '../../theme/gradients';

export default function AuthScreen({ onVerificationSent }) {
  const { sendVerificationCode, phoneVerification } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);

  const handlePhoneInput = ({ value, isValid }) => {
    setPhoneNumber(value);
    setIsValid(isValid);
  };

  const handleSendCode = async () => {
    if (!isValid || !phoneNumber) {
      return;
    }

    const result = await sendVerificationCode(phoneNumber);
    
    if (result.success && onVerificationSent) {
      onVerificationSent(result.phoneNumber);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.title}>Welcome to Voilà!</Text>
        <Text style={styles.subtitle}>
          Enter your phone number to get started
        </Text>

        {/* Phone Input */}
        <View style={styles.inputSection}>
          <PhoneInput
            onInput={handlePhoneInput}
            placeholder="Phone number"
            showValidation={true}
          />
        </View>

        {/* Error Display */}
        {phoneVerification.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{phoneVerification.error}</Text>
          </View>
        )}

        {/* Send Code Button */}
        <GradientView
          gradientName="blueToMagenta"
          style={[styles.sendButton, GRADIENT_STYLES.primaryButton, (!isValid || phoneVerification.isLoading) && styles.sendButtonDisabled]}
        >
          <TouchableOpacity
            style={styles.sendButtonContent}
            onPress={handleSendCode}
            disabled={!isValid || phoneVerification.isLoading}
          >
            {phoneVerification.isLoading ? (
              <LoadingIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.sendButtonText}>Send Verification Code</Text>
            )}
          </TouchableOpacity>
        </GradientView>

        {/* Terms */}
        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
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
  inputSection: {
    marginBottom: 24,
    marginTop: 32,
    width: '100%',
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
  sendButton: {
    borderRadius: 12,
    marginBottom: 24,
  },
  sendButtonContent: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },

}); 