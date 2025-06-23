// Conditional imports to prevent issues when Capacitor plugins aren't available
let StatusBar, Style, Keyboard, KeyboardResize, Capacitor;

// Check if we're running in a Capacitor environment
const isCapacitorAvailable = () => {
  if (typeof window === 'undefined') return false;
  return window.Capacitor && window.Capacitor.isNativePlatform;
};

// Initialize Capacitor modules only when available
async function initializeCapacitor() {
  if (!isCapacitorAvailable()) return false;
  
  try {
    const capacitorCore = await import('@capacitor/core');
    Capacitor = capacitorCore.Capacitor;
    
    if (Capacitor.isNativePlatform()) {
      const statusBarModule = await import('@capacitor/status-bar');
      StatusBar = statusBarModule.StatusBar;
      Style = statusBarModule.Style;
      
      const keyboardModule = await import('@capacitor/keyboard');
      Keyboard = keyboardModule.Keyboard;
      KeyboardResize = keyboardModule.KeyboardResize;
      
      return true;
    }
  } catch (error) {
    console.warn('Capacitor modules not available:', error);
  }
  
  return false;
}

export const isNative = isCapacitorAvailable();
export const platform = isCapacitorAvailable() ? 
  (typeof window !== 'undefined' && window.Capacitor ? window.Capacitor.getPlatform() : 'web') : 
  'web';

// Status Bar Management
export async function setStatusBarDark() {
  if (!await initializeCapacitor()) return;
  
  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (error) {
    console.warn('Status bar not available:', error);
  }
}

// Keyboard Management
export async function setupKeyboard() {
  if (!await initializeCapacitor()) return;

  try {
    // Configure keyboard behavior
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });

    // Listen for keyboard events
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      document.body.classList.add('keyboard-open');
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-open');
    });
  } catch (error) {
    console.warn('Keyboard setup failed:', error);
  }
}

// Device info
export function getDeviceInfo() {
  return {
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isNative,
    platform,
    hasNotch: false, // Simplified since getSafeAreaInsets was removed
  };
} 