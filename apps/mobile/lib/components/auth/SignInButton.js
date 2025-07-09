import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from './AuthModal';
import { GradientView } from '../core';
import { GRADIENT_STYLES } from '../../theme/gradients';

export default function SignInButton({ onPress, style }) {
  const { user, isFullyOnboarded } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Don't show if user is authenticated and fully onboarded
  if (user && isFullyOnboarded) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <>
      <GradientView
        gradientName="lightBlue"
        style={[styles.button, style, GRADIENT_STYLES.card]}
      >
        <TouchableOpacity
          style={styles.buttonContent}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <MaterialIcons name="person" size={16} color="#6366f1" />
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </GradientView>
      
      <AuthModal 
        visible={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
}); 