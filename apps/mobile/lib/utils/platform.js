import { Platform, Dimensions } from 'react-native';

/**
 * Get platform information
 * @returns {Object} Platform details
 */
export function getPlatformInfo() {
  const { width, height } = Dimensions.get('window');
  const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
  
  return {
    os: Platform.OS,
    version: Platform.Version,
    isAndroid: Platform.OS === 'android',
    isIOS: Platform.OS === 'ios',
    isWeb: Platform.OS === 'web',
    isNative: Platform.OS !== 'web',
    dimensions: {
      window: { width, height },
      screen: { width: screenWidth, height: screenHeight }
    }
  };
}

/**
 * Check if device is a tablet
 * @returns {boolean} True if tablet
 */
export function isTablet() {
  const { width, height } = Dimensions.get('window');
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  
  // Consider it a tablet if the aspect ratio is less than 1.6 and min dimension > 600
  return aspectRatio < 1.6 && Math.min(width, height) >= 600;
}

/**
 * Get safe area insets (simplified for React Native)
 * @returns {Object} Safe area insets
 */
export function getSafeAreaInsets() {
  // This would normally use react-native-safe-area-context
  // For now, return default values
  return {
    top: Platform.OS === 'ios' ? 44 : 0,
    bottom: Platform.OS === 'ios' ? 34 : 0,
    left: 0,
    right: 0
  };
}

/**
 * Check if device supports haptics
 * @returns {boolean} True if haptics supported
 */
export function supportsHaptics() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Get device type
 * @returns {string} Device type
 */
export function getDeviceType() {
  if (Platform.OS === 'web') return 'web';
  if (isTablet()) return 'tablet';
  return 'phone';
}

/**
 * Check if dark mode is supported
 * @returns {boolean} True if dark mode supported
 */
export function supportsDarkMode() {
  return true; // React Native supports dark mode detection
}

/**
 * Get navigation bar height (Android)
 * @returns {number} Navigation bar height
 */
export function getNavigationBarHeight() {
  if (Platform.OS === 'android') {
    const { height: windowHeight } = Dimensions.get('window');
    const { height: screenHeight } = Dimensions.get('screen');
    return screenHeight - windowHeight;
  }
  return 0;
}

/**
 * Check if device has notch
 * @returns {boolean} True if has notch
 */
export function hasNotch() {
  const safeArea = getSafeAreaInsets();
  return safeArea.top > 20; // Simple heuristic
}

/**
 * Get status bar height
 * @returns {number} Status bar height
 */
export function getStatusBarHeight() {
  if (Platform.OS === 'ios') {
    return hasNotch() ? 44 : 20;
  } else if (Platform.OS === 'android') {
    return 24; // Default Android status bar height
  }
  return 0;
} 