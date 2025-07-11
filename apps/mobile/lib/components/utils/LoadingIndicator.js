import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Enhanced Meeting Point Loading Component
const MeetingPointLoadingIndicator = ({ size = 'medium', style = {} }) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const spinValue = new Animated.Value(0);

  const steps = [
    { icon: 'search', text: 'Analyzing addresses...', duration: 2000 },
    { icon: 'location-on', text: 'Finding optimal locations...', duration: 3000 },
    { icon: 'directions', text: 'Calculating travel routes...', duration: 2500 },
    { icon: 'restaurant', text: 'Searching nearby venues...', duration: 1500 },
    { icon: 'check-circle', text: 'Finalizing results...', duration: 1000 }
  ];

  React.useEffect(() => {
    const spin = () => {
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => spin());
    };
    spin();

    // Progress through steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        // Reset to beginning for continuous loop
        return 0;
      });
    }, 2000);

    return () => {
      clearInterval(stepInterval);
      spinValue.stopAnimation();
    };
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'large':
        return 60;
      default:
        return 40;
    }
  };

  const ringSize = getSize();
  const currentStepData = steps[currentStep];

  return (
    <View style={[styles.enhancedContainer, style]}>
      <View style={styles.enhancedLoadingAnimation}>
        {/* Animated loading rings */}
        <View style={[styles.loadingRings, { width: ringSize, height: ringSize }]}>
          <View style={[styles.loadingRingOuter, { width: ringSize, height: ringSize }]} />
          <Animated.View 
            style={[
              styles.loadingRingMiddle, 
              { 
                width: ringSize, 
                height: ringSize,
                transform: [{ rotate: spin }] 
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.loadingRingInner, 
              { 
                width: ringSize - 8, 
                height: ringSize - 8,
                transform: [{ rotate: spin }] 
              }
            ]} 
          />
        </View>
        
        {/* Current step icon */}
        <View style={styles.enhancedStepIcon}>
          <MaterialIcons name={currentStepData.icon} size={24} color="#6366f1" />
        </View>
      </View>
      
      {/* Progress steps */}
      <View style={styles.enhancedProgressContainer}>
        <Text style={styles.enhancedProgressTitle}>Finding Your Perfect Meeting Point</Text>
        <Text style={styles.enhancedProgressStep}>{currentStepData.text}</Text>
        
        {/* Progress dots */}
        <View style={styles.enhancedProgressDots}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.enhancedProgressDot,
                index <= currentStep && styles.enhancedProgressDotActive
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const LoadingIndicator = ({ size = 'medium', text = 'Loading...', style = {}, enhanced = false, type = 'default' }) => {
  // Use enhanced meeting point loading for meeting point calculations
  if (enhanced || type === 'meetingPoint') {
    return <MeetingPointLoadingIndicator size={size} style={style} />;
  }

  // Original loading indicator
  const spinValue = new Animated.Value(0);

  React.useEffect(() => {
    const spin = () => {
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => spin());
    };
    spin();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'large':
        return 60;
      default:
        return 40;
    }
  };

  const ringSize = getSize();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.loadingAnimation}>
        {/* Animated loading rings */}
        <View style={[styles.loadingRings, { width: ringSize, height: ringSize }]}>
          <View style={[styles.loadingRingOuter, { width: ringSize, height: ringSize }]} />
          <Animated.View 
            style={[
              styles.loadingRingMiddle, 
              { 
                width: ringSize, 
                height: ringSize,
                transform: [{ rotate: spin }] 
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.loadingRingInner, 
              { 
                width: ringSize - 8, 
                height: ringSize - 8,
                transform: [{ rotate: spin }] 
              }
            ]} 
          />
        </View>
        
        {/* Floating dots animation */}
        <View style={styles.floatingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
      
      {text && <Text style={styles.loadingText}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingAnimation: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
  },
  loadingRings: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRingOuter: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#e0e7ff',
    borderRadius: 50,
  },
  loadingRingMiddle: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#6366f1',
    borderTopColor: 'transparent',
    borderRadius: 50,
  },
  loadingRingInner: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#c7d2fe',
    borderBottomColor: 'transparent',
    borderRadius: 50,
    top: 4,
    left: 4,
  },
  floatingDots: {
    position: 'absolute',
    top: -8,
    flexDirection: 'row',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  dot1: {
    backgroundColor: '#60a5fa',
  },
  dot2: {
    backgroundColor: '#a78bfa',
  },
  dot3: {
    backgroundColor: '#f472b6',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Enhanced styles
  enhancedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8faff',
    borderRadius: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  enhancedLoadingAnimation: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
  },
  enhancedStepIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedProgressContainer: {
    alignItems: 'center',
    width: '100%',
  },
  enhancedProgressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  enhancedProgressStep: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  enhancedProgressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  enhancedProgressDotActive: {
    backgroundColor: '#6366f1',
  },
});

export default LoadingIndicator; 