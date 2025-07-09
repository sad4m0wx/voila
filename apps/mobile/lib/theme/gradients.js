import { StyleSheet } from 'react-native';

// Gradient definitions based on the user's examples and additional complementary gradients
export const GRADIENTS = {
  // Primary gradients from user examples
  greenEmerald: {
    colors: ['rgb(34, 197, 94)', 'rgb(22, 163, 74)'],
    direction: 'to right bottom',
    start: { x: 1, y: 0 },
    end: { x: 0, y: 1 },
  },
  blueToMagenta: {
    colors: ['rgb(59, 130, 246)', 'rgb(168, 85, 247)', 'rgb(236, 72, 153)'],
    direction: 'to right',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  purpleToViolet: {
    colors: ['rgb(168, 85, 247)', 'rgb(147, 51, 234)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Additional complementary gradients
  oceanBlue: {
    colors: ['rgb(6, 182, 212)', 'rgb(3, 105, 161)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  sunsetOrange: {
    colors: ['rgb(251, 146, 60)', 'rgb(234, 88, 12)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  rosePink: {
    colors: ['rgb(244, 114, 182)', 'rgb(219, 39, 119)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  limeGreen: {
    colors: ['rgb(132, 204, 22)', 'rgb(101, 163, 13)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  crimsonRed: {
    colors: ['rgb(239, 68, 68)', 'rgb(185, 28, 28)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Subtle gradients for backgrounds
  lightBlue: {
    colors: ['rgb(240, 249, 255)', 'rgb(219, 234, 254)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  lightGreen: {
    colors: ['rgb(236, 253, 245)', 'rgb(209, 250, 229)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  lightPurple: {
    colors: ['rgb(250, 245, 255)', 'rgb(237, 233, 254)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  lightPink: {
    colors: ['rgb(253, 242, 248)', 'rgb(252, 231, 243)'],
    direction: 'to right bottom',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
};

// Theme categories for easy access
export const GRADIENT_THEMES = {
  primary: ['blueToMagenta', 'purpleToViolet', 'greenEmerald'],
  secondary: ['oceanBlue', 'sunsetOrange', 'rosePink', 'limeGreen'],
  accent: ['crimsonRed'],
  background: ['lightBlue', 'lightGreen', 'lightPurple', 'lightPink'],
};

// Component-specific gradient mappings
export const COMPONENT_GRADIENTS = {
  // Buttons
  primaryButton: 'blueToMagenta',
  confirmButton: 'greenEmerald',
  cancelButton: 'crimsonRed',
  secondaryButton: 'purpleToViolet',
  
  // Cards and containers
  card: 'lightBlue',
  header: 'purpleToViolet',
  navigation: 'lightPurple',
  
  // States
  success: 'greenEmerald',
  error: 'crimsonRed',
  warning: 'sunsetOrange',
  info: 'oceanBlue',
  
  // Slide to confirm
  attendingTrack: 'lightGreen',
  attendingFill: 'greenEmerald',
  notAttendingTrack: 'lightPink',
  notAttendingFill: 'crimsonRed',
};

// Utility function to get gradient colors for react-native-linear-gradient
export const getGradientColors = (gradientName) => {
  const gradient = GRADIENTS[gradientName];
  return gradient ? gradient.colors : ['#ffffff', '#f3f4f6']; // fallback
};

// Utility function to get gradient positions for react-native-linear-gradient
export const getGradientPositions = (gradientName) => {
  const gradient = GRADIENTS[gradientName];
  return gradient ? { start: gradient.start, end: gradient.end } : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
};

// Get specific component gradient
export const getComponentGradient = (componentType) => {
  const gradientName = COMPONENT_GRADIENTS[componentType];
  return gradientName ? GRADIENTS[gradientName] : null;
};

// Create shadow style that matches gradient color
export const createGradientShadow = (gradientName, opacity = 0.3) => {
  const gradient = GRADIENTS[gradientName];
  if (!gradient) return {};
  
  // Use the first color as shadow color
  const shadowColor = gradient.colors[0];
  
  return {
    shadowColor: shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: opacity,
    shadowRadius: 8,
    elevation: 6,
  };
};

// Pre-built gradient style combinations
export const GRADIENT_STYLES = StyleSheet.create({
  primaryButton: {
    ...createGradientShadow('blueToMagenta', 0.4),
  },
  confirmButton: {
    ...createGradientShadow('greenEmerald', 0.4),
  },
  cancelButton: {
    ...createGradientShadow('crimsonRed', 0.4),
  },
  secondaryButton: {
    ...createGradientShadow('purpleToViolet', 0.3),
  },
  card: {
    ...createGradientShadow('lightBlue', 0.1),
  },
  header: {
    ...createGradientShadow('purpleToViolet', 0.2),
  },
}); 