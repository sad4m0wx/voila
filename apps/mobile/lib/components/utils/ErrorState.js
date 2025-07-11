import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GradientView } from '../core';

const EnhancedErrorState = ({
  type = 'general',
  title,
  message,
  icon,
  primaryAction,
  secondaryAction,
  onPrimaryAction,
  onSecondaryAction,
  style = {},
  showAnimation = true
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (showAnimation) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, [showAnimation]);

  // Error type configurations
  const errorConfigs = {
    network: {
      icon: 'wifi-off',
      title: 'Connection Problem',
      message: 'Please check your internet connection and try again.',
      primaryAction: 'Retry',
      secondaryAction: 'Settings',
      color: '#f59e0b',
      backgroundColor: '#fef3c7'
    },
    auth: {
      icon: 'account-circle-off',
      title: 'Authentication Required',
      message: 'Please sign in to access this feature.',
      primaryAction: 'Sign In',
      secondaryAction: 'Continue as Guest',
      color: '#ef4444',
      backgroundColor: '#fef2f2'
    },
    notFound: {
      icon: 'search-off',
      title: 'Not Found',
      message: 'The item you\'re looking for could not be found.',
      primaryAction: 'Go Back',
      secondaryAction: 'Home',
      color: '#6b7280',
      backgroundColor: '#f9fafb'
    },
    server: {
      icon: 'cloud-off',
      title: 'Server Error',
      message: 'Something went wrong on our end. Please try again later.',
      primaryAction: 'Retry',
      secondaryAction: 'Report Issue',
      color: '#dc2626',
      backgroundColor: '#fef2f2'
    },
    permission: {
      icon: 'block',
      title: 'Permission Required',
      message: 'This feature requires additional permissions to work properly.',
      primaryAction: 'Grant Permission',
      secondaryAction: 'Learn More',
      color: '#7c3aed',
      backgroundColor: '#f3f4f6'
    },
    general: {
      icon: 'error',
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      primaryAction: 'Try Again',
      secondaryAction: 'Go Back',
      color: '#ef4444',
      backgroundColor: '#fef2f2'
    }
  };

  const config = errorConfigs[type] || errorConfigs.general;

  // Use provided props or fall back to config defaults
  const finalIcon = icon || config.icon;
  const finalTitle = title || config.title;
  const finalMessage = message || config.message;
  const finalPrimaryAction = primaryAction || config.primaryAction;
  const finalSecondaryAction = secondaryAction || config.secondaryAction;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          backgroundColor: config.backgroundColor
        },
        style
      ]}
    >
      <View style={styles.content}>
        {/* Error Icon */}
        <View style={[styles.iconContainer, { borderColor: config.color }]}>
          <MaterialIcons name={finalIcon} size={48} color={config.color} />
        </View>

        {/* Error Text */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{finalTitle}</Text>
          <Text style={styles.message}>{finalMessage}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Primary Action */}
          {finalPrimaryAction && onPrimaryAction && (
            <GradientView
              gradientName="blueToMagenta"
              style={styles.primaryButton}
            >
              <TouchableOpacity
                style={styles.primaryButtonContent}
                onPress={onPrimaryAction}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{finalPrimaryAction}</Text>
              </TouchableOpacity>
            </GradientView>
          )}

          {/* Secondary Action */}
          {finalSecondaryAction && onSecondaryAction && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: config.color }]}
              onPress={onSecondaryAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: config.color }]}>
                {finalSecondaryAction}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Help Text */}
        <Text style={styles.helpText}>
          Need help? Contact support or check our FAQ
        </Text>
      </View>
    </Animated.View>
  );
};

// Common error state configurations for easy use
export const NetworkErrorState = (props) => (
  <EnhancedErrorState type="network" {...props} />
);

export const AuthErrorState = (props) => (
  <EnhancedErrorState type="auth" {...props} />
);

export const NotFoundErrorState = (props) => (
  <EnhancedErrorState type="notFound" {...props} />
);

export const ServerErrorState = (props) => (
  <EnhancedErrorState type="server" {...props} />
);

export const PermissionErrorState = (props) => (
  <EnhancedErrorState type="permission" {...props} />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonContent: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default EnhancedErrorState; 