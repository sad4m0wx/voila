import { writable, derived, get } from 'svelte/store';

import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

import { auth, db } from '$lib/firebase-auth/config';


const isCapacitor = typeof window !== 'undefined' && window.Capacitor;

const initialState = {
  user: null,
  profile: null,
  addresses: [],
  defaultAddress: null,
  isLoading: true,
  error: null,
  phoneVerification: {
    verificationId: null,
    isLoading: false,
    error: null
  }
};

const authStore = writable(initialState);

let unsubscribe;
export function initAuth() {
  if (unsubscribe) return unsubscribe;
  
  const timeout = isCapacitor ? 5000 : 3000;
  const timeoutId = setTimeout(() => {
    console.warn('Auth initialization timeout after', timeout, 'ms');
    authStore.update(state => ({
      ...state,
      isLoading: false
    }));
  }, timeout);
  
  unsubscribe = onAuthStateChanged(auth, async (user) => {
    clearTimeout(timeoutId);
    
    if (user) {
      authStore.update(state => ({
        ...state,
        user: {
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
        },
        isLoading: true,
        error: null
      }));
      
      try {
        await user.getIdToken();
        
        // Load user profile and addresses in parallel
        await Promise.all([
          loadUserProfile(user.uid),
          loadUserAddresses(user.uid)
        ]);
        authStore.update(state => ({
          ...state,
          isLoading: false
        }));
      } catch (error) {

        authStore.update(state => ({
          ...state,
          user: null,
          error: error.message,
          isLoading: false
        }));
      }
    } else {
      authStore.set({
        ...initialState,
        isLoading: false
      });
    }
  });
  
  return unsubscribe;
}



export async function logout() {
  try {
    await firebaseSignOut(auth);
    
    // Clear ReCAPTCHA
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    
    return { success: true };
  } catch (error) {
    authStore.update(state => ({
      ...state,
      error: error.message
    }));
    return { success: false, error: error.message };
  }
}

// ADDRESS MANAGEMENT FUNCTIONS

/**
 * Validate address object
 */
export function validateAddress(address) {
  return (
    address &&
    typeof address.name === 'string' &&
    address.name.trim().length > 0 &&
    typeof address.formatted === 'string' &&
    address.formatted.trim().length > 0 &&
    Array.isArray(address.coordinates) &&
    address.coordinates.length === 2 &&
    typeof address.coordinates[0] === 'number' &&
    typeof address.coordinates[1] === 'number'
  );
}

/**
 * Create a new address
 */
export async function createAddress(userId, addressData) {
  if (!validateAddress(addressData)) {
    authStore.update(state => ({
      ...state,
      error: 'Invalid address data'
    }));
    return { success: false, error: 'Invalid address data' };
  }

  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    const addressId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const address = {
      id: addressId,
      userId,
      name: addressData.name.trim(),
      formatted: addressData.formatted.trim(),
      coordinates: addressData.coordinates,
      placeId: addressData.placeId || null,
      isDefault: addressData.isDefault || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'userAddresses', addressId), address);
    
    // Reload addresses
    await loadUserAddresses(userId);
    
    return { success: true, address };
  } catch (error) {
    console.error('Error creating address:', error);
    
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));

    return { success: false, error: error.message };
  }
}

/**
 * Update an address
 */
export async function updateAddress(addressId, updates) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    const addressRef = doc(db, 'userAddresses', addressId);
    
    await updateDoc(addressRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    // Reload addresses
    const state = get(authStore);
    if (state.user?.uid) {
      await loadUserAddresses(state.user.uid);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating address:', error);
    
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));

    return { success: false, error: error.message };
  }
}

/**
 * Delete an address
 */
export async function deleteAddress(addressId) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    await deleteDoc(doc(db, 'userAddresses', addressId));

    // Reload addresses
    const state = get(authStore);
    if (state.user?.uid) {
      await loadUserAddresses(state.user.uid);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting address:', error);
    
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));

    return { success: false, error: error.message };
  }
}

/**
 * Set an address as default
 */
export async function setDefaultAddress(userId, addressId) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    // First, remove default flag from all user addresses
    const addressesQuery = query(
      collection(db, 'userAddresses'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(addressesQuery);
    const batch = [];
    
    querySnapshot.forEach((doc) => {
      if (doc.data().isDefault) {
        batch.push(updateDoc(doc.ref, { isDefault: false, updatedAt: serverTimestamp() }));
      }
    });
    
    // Wait for all updates to complete
    await Promise.all(batch);
    
    // Set the new default address
    await updateDoc(doc(db, 'userAddresses', addressId), {
      isDefault: true,
      updatedAt: serverTimestamp()
    });

    // Reload addresses
    await loadUserAddresses(userId);

    return { success: true };
  } catch (error) {
    console.error('Error setting default address:', error);
    
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));

    return { success: false, error: error.message };
  }
}

/**
 * Geocode an address string to coordinates
 */
export async function geocodeAddress(addressString) {
  try {
    if (!window.google || !window.google.maps) {
      return {
        success: false,
        error: 'Google Maps not loaded'
      };
    }

    const geocoder = new window.google.maps.Geocoder();
    
    return new Promise((resolve) => {
      geocoder.geocode({ address: addressString }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const result = results[0];
          resolve({
            success: true,
            result: {
              formatted: result.formatted_address,
              coordinates: [
                result.geometry.location.lng(),
                result.geometry.location.lat()
              ],
              placeId: result.place_id
            }
          });
        } else {
          resolve({
            success: false,
            error: 'Could not geocode address'
          });
        }
      });
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clear error state
 */
export function clearError() {
  authStore.update(state => ({
    ...state,
    error: null,
    phoneVerification: {
      ...state.phoneVerification,
      error: null
    }
  }));
}

// ReCAPTCHA verifier for phone auth
let recaptchaVerifier = null;

/**
 * Initialize ReCAPTCHA verifier
 */
function initRecaptcha() {
  if (typeof window === 'undefined') return null;
  
  if (!recaptchaVerifier) {
    try {
      // Detect if we're on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      console.log('Initializing reCAPTCHA - isMobile:', isMobile, 'isCapacitor:', isCapacitor);
      
      // Use visible reCAPTCHA on mobile/Capacitor for better compatibility
      const recaptchaConfig = {
        size: (isMobile || isCapacitor) ? 'normal' : 'invisible',
        callback: () => {
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          // Clear and reinitialize if expired
          if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
          }
        },
        'error-callback': (error) => {
          console.error('reCAPTCHA error:', error);
        }
      };

      // Use mobile-specific container if available, otherwise use main container
      const containerId = document.getElementById('recaptcha-container-mobile') ? 'recaptcha-container-mobile' : 'recaptcha-container';
      
      // Clear any existing reCAPTCHA content (important for mobile)
      const container = document.getElementById(containerId);
      if (container && container.innerHTML) {
        container.innerHTML = '';
      }
      
      recaptchaVerifier = new RecaptchaVerifier(auth, containerId, recaptchaConfig);
      
      // For visible reCAPTCHA, render it immediately
      if (isMobile || isCapacitor) {
        recaptchaVerifier.render().then(() => {
        }).catch((error) => {
          recaptchaVerifier = null;
        });
      }
    } catch (error) {
      console.error('Failed to initialize reCAPTCHA:', error);
      return null;
    }
  }
  return recaptchaVerifier;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
  }
  
  return cleaned;
}

/**
 * Get country codes for phone number input
 */
export function getCountryCodes() {
  return [
    { code: '+1', country: 'US/CA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+33', country: 'FR', flag: '🇫🇷' },
    { code: '+49', country: 'DE', flag: '🇩🇪' },
    { code: '+39', country: 'IT', flag: '🇮🇹' },
    { code: '+34', country: 'ES', flag: '🇪🇸' },
    { code: '+31', country: 'NL', flag: '🇳🇱' },
    { code: '+32', country: 'BE', flag: '🇧🇪' },
    { code: '+41', country: 'CH', flag: '🇨🇭' },
    { code: '+43', country: 'AT', flag: '🇦🇹' },
    { code: '+45', country: 'DK', flag: '🇩🇰' },
    { code: '+46', country: 'SE', flag: '🇸🇪' },
    { code: '+47', country: 'NO', flag: '🇳🇴' },
    { code: '+358', country: 'FI', flag: '🇫🇮' },
    { code: '+351', country: 'PT', flag: '🇵🇹' },
    { code: '+30', country: 'GR', flag: '🇬🇷' },
    { code: '+48', country: 'PL', flag: '🇵🇱' },
    { code: '+420', country: 'CZ', flag: '🇨🇿' },
    { code: '+36', country: 'HU', flag: '🇭🇺' },
    { code: '+40', country: 'RO', flag: '🇷🇴' },
    { code: '+359', country: 'BG', flag: '🇧🇬' },
    { code: '+385', country: 'HR', flag: '🇭🇷' },
    { code: '+386', country: 'SI', flag: '🇸🇮' },
    { code: '+421', country: 'SK', flag: '🇸🇰' },
    { code: '+372', country: 'EE', flag: '🇪🇪' },
    { code: '+371', country: 'LV', flag: '🇱🇻' },
    { code: '+370', country: 'LT', flag: '🇱🇹' }
  ];
}

/**
 * Send SMS verification code
 */
export async function sendVerificationCode(phoneNumber) {
  if (!validatePhoneNumber(phoneNumber)) {
    authStore.update(state => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        error: 'Invalid phone number format'
      }
    }));
    return { success: false, error: 'Invalid phone number format' };
  }

  authStore.update(state => ({
    ...state,
    phoneVerification: {
      ...state.phoneVerification,
      isLoading: true,
      error: null
    }
  }));

  try {
    const recaptcha = initRecaptcha();
    if (!recaptcha) {
      throw new Error('ReCAPTCHA not initialized. Please refresh the page and try again.');
    }

    // Store the confirmation result globally for later verification
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
      
    
    authStore.update(state => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        verificationId: confirmationResult.verificationId,
        isLoading: false
      }
    }));

    return {
      success: true,
      verificationId: confirmationResult.verificationId
    };
  } catch (error) {
    console.error('Error sending verification code:', error);
    
    let errorMessage = error.message;
    
    // Handle specific Firebase error codes
    switch (error.code) {
      case 'auth/invalid-phone-number':
        errorMessage = 'Invalid phone number format';
        break;
      case 'auth/missing-phone-number':
        errorMessage = 'Phone number is required';
        break;
      case 'auth/quota-exceeded':
        errorMessage = 'SMS quota exceeded. Please try again later';
        break;
      case 'auth/invalid-app-credential':
        errorMessage = 'Phone authentication not enabled. Please enable it in Firebase Console';
        break;
      case 'auth/captcha-check-failed':
        errorMessage = 'reCAPTCHA verification failed. Please try again';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many requests. Please try again later';
        break;
      default:
        errorMessage = error.message || 'Failed to send verification code';
    }
    
    authStore.update(state => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        isLoading: false,
        error: errorMessage
      }
    }));

    return {
      success: false,
      error: errorMessage
    };
  }
}

// Store confirmation result globally for verification
let confirmationResult = null;

/**
 * Verify SMS code
 */
export async function verifyCode(verificationId, code) {
  authStore.update(state => ({
    ...state,
    phoneVerification: {
      ...state.phoneVerification,
      isLoading: true,
      error: null
    }
  }));

  try {
    if (!confirmationResult) {
      throw new Error('No verification in progress');
    }

    // Confirm the verification code
    const result = await confirmationResult.confirm(code);
    const user = result.user;
    
    // Clear the confirmation result
    confirmationResult = null;
    
    authStore.update(state => ({
      ...state,
      phoneVerification: {
        verificationId: null,
        isLoading: false,
        error: null
      }
    }));

    return {
      success: true,
      phoneNumber: user.phoneNumber,
      user
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    
    authStore.update(state => ({
      ...state,
      phoneVerification: {
        ...state.phoneVerification,
        isLoading: false,
        error: error.code === 'auth/invalid-verification-code' 
          ? 'Invalid verification code' 
          : error.message
      }
    }));

    return {
      success: false,
      error: error.code === 'auth/invalid-verification-code' 
        ? 'Invalid verification code' 
        : error.message
    };
  }
}

/**
 * Check if phone number is already registered
 */
export async function checkPhoneNumberExists(phoneNumber) {
  try {
    // Query users collection to find if any user has this phone number
    const usersQuery = query(
      collection(db, 'users'),
      where('phoneNumber', '==', phoneNumber)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking phone number:', error);
    return false;
  }
}

/**
 * Create user profile
 */
export async function createUserProfile(uid, phoneNumber, displayName) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    const userProfile = {
      uid,
      phoneNumber,
      displayName: displayName.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      registrationCompleted: true
    };

    await setDoc(doc(db, 'users', uid), userProfile);
    
    authStore.update(state => ({
      ...state,
      profile: userProfile,
      isLoading: false
    }));

    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));

    return { success: false, error: error.message };
  }
}

/**
 * Load user profile
 */
async function loadUserProfile(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const profile = userSnap.data();
      authStore.update(state => ({
        ...state,
        profile,
        isLoading: false
      }));
    } else {
      // Profile doesn't exist - still set loading to false
      console.warn('User profile not found for uid:', uid);
      authStore.update(state => ({
        ...state,
        profile: null,
        isLoading: false
      }));
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    authStore.update(state => ({
      ...state,
      error: error.message,
      isLoading: false
    }));
  }
}

/**
 * Load user addresses
 */
async function loadUserAddresses(userId) {
  try {
    const addressesQuery = query(
      collection(db, 'userAddresses'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(addressesQuery);
    const addresses = [];
    
    querySnapshot.forEach((doc) => {
      addresses.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date, with default address first
    addresses.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.createdAt?.toDate() - a.createdAt?.toDate();
    });

    const defaultAddress = addresses.find(addr => addr.isDefault) || null;

    authStore.update(state => ({
      ...state,
      addresses,
      defaultAddress,
      isLoading: false
    }));
  } catch (error) {
    console.error('Error loading addresses:', error);
    authStore.update(state => ({
      ...state,
      error: error.message,
      isLoading: false
    }));
  }
}

// Derived stores for convenience
export const user = derived(authStore, $auth => $auth.user);
export const profile = derived(authStore, $auth => $auth.profile);
export const addresses = derived(authStore, $auth => $auth.addresses);
export const defaultAddress = derived(authStore, $auth => $auth.defaultAddress);
export const isLoading = derived(authStore, $auth => $auth.isLoading);
export const error = derived(authStore, $auth => $auth.error);
export const isAuthenticated = derived(authStore, $auth => $auth.user !== null);
export const phoneVerification = derived(authStore, $auth => $auth.phoneVerification);

// Export the store itself
export { authStore };