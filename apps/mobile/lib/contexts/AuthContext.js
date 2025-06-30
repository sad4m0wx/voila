import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  PhoneAuthProvider,
  signInWithCredential
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
import { auth, db } from '../firebase-auth/config';
import { createUserProfile, getUserProfile } from '../firebase-auth/users';

// Initial state
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

// Action types
const AuthActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_PROFILE: 'SET_PROFILE',
  SET_ADDRESSES: 'SET_ADDRESSES',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_PHONE_VERIFICATION: 'SET_PHONE_VERIFICATION',
  RESET_STATE: 'RESET_STATE'
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AuthActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case AuthActionTypes.SET_USER:
      return { ...state, user: action.payload, isLoading: false, error: null };
    case AuthActionTypes.SET_PROFILE:
      return { ...state, profile: action.payload };
    case AuthActionTypes.SET_ADDRESSES:
      return { 
        ...state, 
        addresses: action.payload.addresses,
        defaultAddress: action.payload.defaultAddress
      };
    case AuthActionTypes.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case AuthActionTypes.CLEAR_ERROR:
      return { ...state, error: null, phoneVerification: { ...state.phoneVerification, error: null } };
    case AuthActionTypes.SET_PHONE_VERIFICATION:
      return { ...state, phoneVerification: { ...state.phoneVerification, ...action.payload } };
    case AuthActionTypes.RESET_STATE:
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext(null);

// Provider component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        dispatch({
          type: AuthActionTypes.SET_USER,
          payload: {
            uid: user.uid,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName,
          }
        });

        try {
          // Load user profile and addresses in parallel
          await Promise.all([
            loadUserProfile(user.uid),
            loadUserAddresses(user.uid)
          ]);
        } catch (error) {
          console.error('Error loading user data:', error);
          dispatch({
            type: AuthActionTypes.SET_ERROR,
            payload: error.message
          });
        }
      } else {
        dispatch({ type: AuthActionTypes.RESET_STATE });
      }
    });

    return unsubscribe;
  }, []);

  // Load user profile
  const loadUserProfile = useCallback(async (uid) => {
    try {
      const profile = await getUserProfile(db, uid);
      
      if (profile) {
        dispatch({
          type: AuthActionTypes.SET_PROFILE,
          payload: profile
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      throw error;
    }
  }, []);

  // Load user addresses
  const loadUserAddresses = useCallback(async (userId) => {
    try {
      const addressesQuery = query(
        collection(db, 'userAddresses'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(addressesQuery);
      const addresses = [];
      let defaultAddress = null;
      
      querySnapshot.forEach((doc) => {
        const addressData = { id: doc.id, ...doc.data() };
        addresses.push(addressData);
        if (addressData.isDefault) {
          defaultAddress = addressData;
        }
      });
      
      dispatch({
        type: AuthActionTypes.SET_ADDRESSES,
        payload: { addresses, defaultAddress }
      });
    } catch (error) {
      console.error('Error loading user addresses:', error);
      throw error;
    }
  }, []);

  // Send verification code
  const sendVerificationCode = useCallback(async (phoneNumber) => {
    dispatch({
      type: AuthActionTypes.SET_PHONE_VERIFICATION,
      payload: { isLoading: true, error: null }
    });

    try {
      // Note: For React Native, you might need to use a different approach
      // This is a simplified version - you may need to implement reCAPTCHA or use Firebase Auth UI
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
      
      dispatch({
        type: AuthActionTypes.SET_PHONE_VERIFICATION,
        payload: { 
          verificationId: confirmation.verificationId,
          isLoading: false 
        }
      });
      
      return { success: true, confirmation };
    } catch (error) {
      console.error('Error sending verification code:', error);
      dispatch({
        type: AuthActionTypes.SET_PHONE_VERIFICATION,
        payload: { isLoading: false, error: error.message }
      });
      return { success: false, error: error.message };
    }
  }, []);

  // Verify code
  const verifyCode = useCallback(async (verificationId, code) => {
    dispatch({
      type: AuthActionTypes.SET_PHONE_VERIFICATION,
      payload: { isLoading: true, error: null }
    });

    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const result = await signInWithCredential(auth, credential);
      
      dispatch({
        type: AuthActionTypes.SET_PHONE_VERIFICATION,
        payload: { isLoading: false, verificationId: null }
      });
      
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Error verifying code:', error);
      dispatch({
        type: AuthActionTypes.SET_PHONE_VERIFICATION,
        payload: { isLoading: false, error: error.message }
      });
      return { success: false, error: error.message };
    }
  }, []);

  // Create user profile
  const createUserProfileAction = useCallback(async (uid, phoneNumber, displayName) => {
    try {
      const userData = {
        displayName: displayName || '',
        phoneNumber,
        photoURL: '',
        addresses: [],
        friends: []
      };
      
      await createUserProfile(db, uid, userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Error creating user profile:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Error logging out:', error);
      dispatch({
        type: AuthActionTypes.SET_ERROR,
        payload: error.message
      });
      return { success: false, error: error.message };
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: AuthActionTypes.CLEAR_ERROR });
  }, []);

  // Address management functions
  const createAddress = useCallback(async (addressData) => {
    if (!state.user?.uid) return { success: false, error: 'User not authenticated' };

    dispatch({ type: AuthActionTypes.SET_LOADING, payload: true });

    try {
      const addressId = `${state.user.uid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const address = {
        id: addressId,
        userId: state.user.uid,
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
      await loadUserAddresses(state.user.uid);
      
      return { success: true, address };
    } catch (error) {
      console.error('Error creating address:', error);
      dispatch({
        type: AuthActionTypes.SET_ERROR,
        payload: error.message
      });
      return { success: false, error: error.message };
    }
  }, [state.user, loadUserAddresses]);

  const value = {
    // State
    ...state,
    
    // Actions
    sendVerificationCode,
    verifyCode,
    createUserProfile: createUserProfileAction,
    logout,
    clearError,
    createAddress,
    loadUserProfile,
    loadUserAddresses
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext; 