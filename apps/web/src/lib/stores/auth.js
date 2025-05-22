import { writable, derived, get } from 'svelte/store';
import { 
  initializeFirebase,
} from '$firebase-auth/config';

import {
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  signOut as firebaseSignOut,
  resetPassword as firebaseResetPassword,
  signInAsGuest as firebaseSignInAsGuest,
  convertAnonymousAccount as firebaseConvertAnonymousAccount,
  subscribeToAuthChanges
} from '$firebase-auth/auth';

import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  saveAddress as saveUserAddress,
  setHomeAddress as setUserHomeAddress
} from '$firebase-auth/users';

// Initialize Firebase
// In production, load this from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase instances
const { auth, db, functions } = initializeFirebase(firebaseConfig);

// Initial state
const initialState = {
  user: null,
  profile: null,
  isLoading: true,
  error: null
};

// Create the store
const authStore = writable(initialState);

// Initialize auth listener (call this ONCE in your root component)
let unsubscribe;
export function initAuth() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToAuthChanges(auth, async (user) => {
    if (user) {
      authStore.update(state => ({
        ...state,
        user: {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous
        },
        isLoading: true,
        error: null
      }));
      try {
        const profile = await getUserProfile(db, user.uid);
        if (profile) {
          authStore.update(state => ({
            ...state,
            profile,
            isLoading: false
          }));
        } else {
          await createUserProfile(db, user.uid, {
            displayName: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            isAnonymous: user.isAnonymous
          });
          const newProfile = await getUserProfile(db, user.uid);
          authStore.update(state => ({
            ...state,
            profile: newProfile,
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
    } else {
      authStore.set({
        user: null,
        profile: null,
        isLoading: false,
        error: null
      });
    }
  });
  return unsubscribe;
}

// Authentication methods
export async function login(email, password) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));
  
  try {
    const result = await firebaseSignIn(auth, email, password);
    
    if (result.error) {
      authStore.update(state => ({
        ...state,
        isLoading: false,
        error: result.error
      }));
      return false;
    }
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));
    return false;
  }
}

export async function register(email, password, displayName) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));
  
  try {
    const result = await firebaseSignUp(auth, email, password, displayName);
    
    if (result.error) {
      authStore.update(state => ({
        ...state,
        isLoading: false,
        error: result.error
      }));
      return false;
    }
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));
    return false;
  }
}

export async function logout() {
  try {
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

export async function loginAsGuest() {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));
  
  try {
    const result = await firebaseSignInAsGuest(auth);
    
    if (result.error) {
      authStore.update(state => ({
        ...state,
        isLoading: false,
        error: result.error
      }));
      return false;
    }
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));
    return false;
  }
}

export async function convertGuestAccount(email, password, displayName) {
  authStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));
  
  try {
    const result = await firebaseConvertAnonymousAccount(auth, email, password);
    
    if (result.error) {
      authStore.update(state => ({
        ...state,
        isLoading: false,
        error: result.error
      }));
      return false;
    }
    
    // Update the display name if provided
    if (displayName && result.user) {
      await updateUserProfile(db, result.user.uid, { displayName });
    }
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      isLoading: false,
      error: error.message
    }));
    return false;
  }
}

export async function sendPasswordReset(email) {
  try {
    const result = await firebaseResetPassword(auth, email);
    
    if (result.error) {
      authStore.update(state => ({
        ...state,
        error: result.error
      }));
      return false;
    }
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

// Save address for a user
export async function saveAddress(address) {
  const state = get(authStore);
  
  if (!state.user) {
    throw new Error('User not signed in');
  }
  
  try {
    await saveUserAddress(db, state.user.uid, address);
    
    // Update profile in store
    const profile = await getUserProfile(db, state.user.uid);
    
    authStore.update(state => ({
      ...state,
      profile
    }));
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

// Set home address
export async function setHomeAddress(address) {
  const state = get(authStore);
  
  if (!state.user) {
    throw new Error('User not signed in');
  }
  
  try {
    await setUserHomeAddress(db, state.user.uid, address);
    
    // Update profile in store
    const profile = await getUserProfile(db, state.user.uid);
    
    authStore.update(state => ({
      ...state,
      profile
    }));
    
    return true;
  } catch (error) {
    authStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

// Derived stores for convenience
export const user = derived(authStore, $auth => $auth.user);
export const profile = derived(authStore, $auth => $auth.profile);
export const isLoading = derived(authStore, $auth => $auth.isLoading);
export const error = derived(authStore, $auth => $auth.error);
export const isAuthenticated = derived(authStore, $auth => $auth.user !== null);
export const isAnonymous = derived(authStore, $auth => $auth.user?.isAnonymous || false);
export const savedAddresses = derived(profile, $profile => $profile?.savedAddresses || []);

// Export the store itself
export { authStore };