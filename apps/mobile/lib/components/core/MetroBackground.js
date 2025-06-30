import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MetroBackground = () => {
  return (
    <View style={styles.container}>
      {/* Grid pattern */}
      <View style={styles.gridPattern}>
        {/* Horizontal lines */}
        {Array.from({ length: Math.ceil(screenHeight / 40) }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLine, styles.horizontalLine, { top: i * 40 }]} />
        ))}
        {/* Vertical lines */}
        {Array.from({ length: Math.ceil(screenWidth / 40) }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLine, styles.verticalLine, { left: i * 40 }]} />
        ))}
      </View>

      {/* Animated metro elements */}
      <View style={styles.metroElements}>
        {/* Station nodes */}
        <View style={[styles.station, { top: '20%', left: '15%' }]} />
        <View style={[styles.station, { top: '40%', right: '20%' }]} />
        <View style={[styles.station, { bottom: '30%', left: '25%' }]} />
        <View style={[styles.station, { top: '60%', right: '15%' }]} />
        
        {/* Metro lines */}
        <View style={[styles.metroLine, styles.metroLine1]} />
        <View style={[styles.metroLine, styles.metroLine2]} />
        <View style={[styles.metroLine, styles.metroLine3]} />
      </View>

      {/* Gradient overlay */}
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
  gridPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  horizontalLine: {
    left: 0,
    right: 0,
    height: 1,
  },
  verticalLine: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  metroElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  station: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  metroLine: {
    position: 'absolute',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  metroLine1: {
    top: '20%',
    left: '10%',
    right: '10%',
    height: 2,
    transform: [{ rotate: '15deg' }],
  },
  metroLine2: {
    top: '50%',
    left: '5%',
    right: '20%',
    height: 2,
    transform: [{ rotate: '-10deg' }],
  },
  metroLine3: {
    bottom: '30%',
    left: '20%',
    right: '5%',
    height: 2,
    transform: [{ rotate: '8deg' }],
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

export default MetroBackground; 