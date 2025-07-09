import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { GradientView } from '../core';
import { GRADIENT_STYLES } from '../../theme/gradients';

export default function ProfileButton({ onPress, style }) {
  const { user, isFullyOnboarded, profile } = useAuth();
  const router = useRouter();

  // Don't show if user is not authenticated or not fully onboarded
  if (!user || !isFullyOnboarded) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to profile screen as a modal
      router.push('/profile');
    }
  };

  return (
    <GradientView
      gradientName="lightPurple"
      style={[styles.button, style, GRADIENT_STYLES.card]}
    >
      <TouchableOpacity
        style={styles.buttonContent}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <MaterialIcons name="account-circle" size={16} color="#6366f1" />
        <Text style={styles.buttonText} numberOfLines={1}>
          {profile?.display_name?.split(' ')[0] || 'Profile'}
        </Text>
      </TouchableOpacity>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    maxWidth: 120,
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