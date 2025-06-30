import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const LoadingIndicator = ({
  text = 'Loading...',
  color = '#3b82f6',
  size = 'large',
  fullScreen = false,
  showText = true
}) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.fullScreenContent}>
          <ActivityIndicator size={size} color={color} />
          {showText && <Text style={[styles.text, { color }]}>{text}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={color} />
      {showText && <Text style={[styles.text, { color }]}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  fullScreenContent: {
    alignItems: 'center',
    padding: 20,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LoadingIndicator; 