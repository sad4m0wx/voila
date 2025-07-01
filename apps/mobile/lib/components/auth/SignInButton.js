import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from './AuthModal';

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
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <MaterialIcons name="person" size={16} color="#6366f1" />
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
      
      <AuthModal 
        visible={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  buttonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
}); 