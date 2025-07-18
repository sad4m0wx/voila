import React from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { GroupsProvider } from '../contexts/GroupsContext';
import { MeetingPointProvider } from '../contexts/MeetingPointContext';
import { useAppInitialization } from '../hooks/useAppInitialization';
import LoadingIndicator from './utils/LoadingIndicator';
import { GradientView } from './core';

// App Initialization Loading Screen
const AppLoadingScreen = () => {
  const [loadingStep, setLoadingStep] = React.useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const loadingSteps = [
    { icon: 'location-on', text: 'Initializing location services...' },
    { icon: 'account-circle', text: 'Setting up user preferences...' },
    { icon: 'group', text: 'Loading your groups...' },
    { icon: 'map', text: 'Preparing maps and routes...' },
    { icon: 'check-circle', text: 'Almost ready!' }
  ];

  React.useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Progress through loading steps
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 800);

    return () => clearInterval(stepInterval);
  }, [fadeAnim]);

  const currentStep = loadingSteps[loadingStep];

  return (
    <SafeAreaView style={styles.loadingScreen}>
      <GradientView gradientName="lightPurple" style={styles.loadingBackground}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
          {/* App Logo/Icon */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Text style={styles.logoEmoji}>📍</Text>
            </View>
            <Text style={styles.logoText}>Voilà!</Text>
            <Text style={styles.logoSubtext}>Find perfect meeting points</Text>
          </View>

          {/* Loading Animation */}
          <View style={styles.loadingAnimation}>
            <LoadingIndicator size="large" />
          </View>

          {/* Loading Steps */}
          <View style={styles.loadingSteps}>
            <View style={styles.currentStepContainer}>
              <MaterialIcons name={currentStep.icon} size={24} color="#6366f1" />
              <Text style={styles.currentStepText}>{currentStep.text}</Text>
            </View>

            {/* Progress indicators */}
            <View style={styles.progressIndicators}>
              {loadingSteps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index <= loadingStep && styles.progressDotActive
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Version info */}
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </Animated.View>
      </GradientView>
    </SafeAreaView>
  );
};

const AppInitializer = ({ children }) => {
  const { isLoading } = useAuth();
  
  useAppInitialization();
  
  if (isLoading) {
    return <AppLoadingScreen />;
  }
  
  return children;
};

const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      <GroupsProvider>
        <MeetingPointProvider>
          <AppInitializer>
            {children}
          </AppInitializer>
        </MeetingPointProvider>
      </GroupsProvider>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
  },
  loadingBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoEmoji: {
    fontSize: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingAnimation: {
    marginBottom: 40,
  },
  loadingSteps: {
    alignItems: 'center',
    marginBottom: 40,
  },
  currentStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  currentStepText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  progressIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#6366f1',
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
    opacity: 0.8,
  },
});

export default AppProviders; 