import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const LoadingIndicator = ({ size = 'medium', text = 'Loading...', style = {} }) => {
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
});

export default LoadingIndicator; 