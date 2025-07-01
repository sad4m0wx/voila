import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import AuthScreen from './AuthScreen';
import VerificationScreen from './VerificationScreen';
import { NameSetupScreen, AddressSetupScreen, ContactsSetupScreen } from './OnboardingScreens';

export default function AuthNavigator({ onClose }) {
  const { user, onboardingStep, phoneVerification, checkUserProfile } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [verificationPhoneNumber, setVerificationPhoneNumber] = useState(null);

  // Check if we need to determine onboarding step for authenticated user
  useEffect(() => {
    if (user && !onboardingStep) {
      checkUserProfile(user.uid);
    }
  }, [user, onboardingStep, checkUserProfile]);

  // Handle verification code sent
  const handleVerificationSent = (phoneNumber) => {
    setVerificationPhoneNumber(phoneNumber);
    setCurrentScreen('verification');
  };

  // Handle back from verification
  const handleBackToAuth = () => {
    setCurrentScreen('auth');
    setVerificationPhoneNumber(null);
  };

  // Handle verification success
  const handleVerificationSuccess = () => {
    // Auth context will handle the next steps based on onboarding state
    setCurrentScreen('auth');
    setVerificationPhoneNumber(null);
  };

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    // Close the auth modal
    if (onClose) {
      onClose();
    }
  };

  // If user is authenticated, show onboarding screens based on step
  if (user && onboardingStep) {
    switch (onboardingStep) {
      case 'name':
        return <NameSetupScreen onComplete={handleOnboardingComplete} onClose={onClose} />;
      case 'address':
        return <AddressSetupScreen onComplete={handleOnboardingComplete} onClose={onClose} />;
      case 'contacts':
        return <ContactsSetupScreen onComplete={handleOnboardingComplete} onClose={onClose} />;
      case 'complete':
        // User is fully onboarded, go back to main app
        handleOnboardingComplete();
        return null;
              default:
                  // If no valid onboarding step, show name setup
        return <NameSetupScreen onComplete={handleOnboardingComplete} onClose={onClose} />;
    }
  }

  // If not authenticated, show auth flow
  switch (currentScreen) {
    case 'verification':
      return (
        <VerificationScreen
          phoneNumber={verificationPhoneNumber}
          onBack={handleBackToAuth}
          onVerified={handleVerificationSuccess}
        />
      );
    case 'simple':
      return (
        <AuthScreen
          onVerificationSent={handleVerificationSent}
        />
      );
    case 'auth':
    default:
      return (
        <AuthScreen
          onVerificationSent={handleVerificationSent}
        />
      );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 