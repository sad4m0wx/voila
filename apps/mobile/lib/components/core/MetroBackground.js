import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const MetroBackground = () => {
  const animatedValue = new Animated.Value(0);

  React.useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };
    animate();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.1, 0.3, 0.1],
  });

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  return (
    <View style={styles.container}>
      {/* Animated Metro Lines */}
      <Animated.View 
        style={[
          styles.metroLine,
          styles.line1,
          {
            opacity,
            transform: [{ translateY }]
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.metroLine,
          styles.line2,
          {
            opacity: opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0.15, 0.35],
            }),
            transform: [{ 
              translateY: translateY.interpolate({
                inputRange: [0, 1],
                outputRange: [10, -10],
              })
            }]
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.metroLine,
          styles.line3,
          {
            opacity: opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.25],
            }),
            transform: [{ 
              translateY: translateY.interpolate({
                inputRange: [0, 1],
                outputRange: [20, -30],
              })
            }]
          }
        ]} 
      />
      
      {/* Metro Stations (Dots) */}
      <View style={[styles.station, styles.station1]} />
      <View style={[styles.station, styles.station2]} />
      <View style={[styles.station, styles.station3]} />
      <View style={[styles.station, styles.station4]} />
      
      {/* Background Gradient Overlay */}
      <View style={styles.gradientOverlay} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  metroLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  line1: {
    backgroundColor: '#6366f1',
    width: '120%',
    top: '20%',
    left: '-10%',
    transform: [{ rotate: '15deg' }],
  },
  line2: {
    backgroundColor: '#8b5cf6',
    width: '100%',
    top: '45%',
    left: '-5%',
    transform: [{ rotate: '-12deg' }],
  },
  line3: {
    backgroundColor: '#06b6d4',
    width: '80%',
    top: '70%',
    left: '10%',
    transform: [{ rotate: '8deg' }],
  },
  station: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  station1: {
    top: '18%',
    left: '15%',
  },
  station2: {
    top: '43%',
    right: '20%',
  },
  station3: {
    top: '68%',
    left: '25%',
  },
  station4: {
    top: '25%',
    right: '15%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default MetroBackground; 