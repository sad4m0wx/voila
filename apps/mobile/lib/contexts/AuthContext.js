import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { supabaseAuthService } from '../services/supabaseAuth';
import { supabase } from '../config';

// Initial state
const initialState = {
  user: null,
  profile: null,
  addresses: [],
  isLoading: true,
  error: null,
  onboardingStep: null, // 'name', 'address', 'contacts', 'complete'
  phoneVerification: {
    phoneNumber: null,
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
  SET_ONBOARDING_STEP: 'SET_ONBOARDING_STEP',
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
      return { ...state, addresses: action.payload };
    case AuthActionTypes.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case AuthActionTypes.CLEAR_ERROR:
      return { ...state, error: null, phoneVerification: { ...state.phoneVerification, error: null } };
    case AuthActionTypes.SET_PHONE_VERIFICATION:
      return { ...state, phoneVerification: { ...state.phoneVerification, ...action.payload } };
    case AuthActionTypes.SET_ONBOARDING_STEP:
      return { ...state, onboardingStep: action.payload };
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
    const { data: authListener } = supabaseAuthService.onAuthStateChange(async (event, session) => {
      
      if (session?.user) {
        const user = {
          uid: session.user.id,
          phoneNumber: session.user.phone,
          displayName: session.user.user_metadata?.display_name || '',
          email: session.user.email || null,
        };

        dispatch({
          type: AuthActionTypes.SET_USER,
          payload: user
        });

        try {
          // Load user profile but don't automatically set onboarding step
          await loadUserProfile(session.user.id);
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else {
        dispatch({ type: AuthActionTypes.RESET_STATE });
      }
    });

    return () => {
      authListener?.unsubscribe?.();
    };
  }, [loadUserProfile]);

  // Load user profile without setting onboarding step automatically
  const loadUserProfile = useCallback(async (userId) => {
    try {
      // Check if user has completed profile setup
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return;
        } else if (error.code === '42P01') {
          console.warn('⚠️  Database tables not set up. See DATABASE_SETUP.md for instructions.');
          console.warn('User can still use the app without authentication features.');
          return;
        } else {
          throw error;
        }
      }

      if (profile) {
        dispatch({ type: AuthActionTypes.SET_PROFILE, payload: profile });
        
        // Check if user is fully onboarded and set step to complete
        if (profile.display_name && profile.has_address && profile.has_contacts) {
          dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'complete' });
        }

        // Load user addresses if profile exists
        await loadUserAddresses(userId);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }, [loadUserAddresses]);

  // Check user profile and determine onboarding step (only called when needed)
  const checkUserProfile = useCallback(async (userId) => {
    try {
      // Check if user has completed profile setup
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - new user
          dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'name' });
          return;
        } else if (error.code === '42P01') {
          // Table doesn't exist - database not set up
          console.warn('⚠️  Database tables not set up. See DATABASE_SETUP.md for instructions.');
          console.warn('User can still use the app without authentication features.');
          dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'name' });
          return;
        } else {
          throw error;
        }
      }

      if (!profile) {
        // New user - needs to complete name setup
        dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'name' });
        return;
      }

      dispatch({ type: AuthActionTypes.SET_PROFILE, payload: profile });

      // Check if user has completed all onboarding steps
      if (!profile.display_name) {
        dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'name' });
      } else if (!profile.has_address) {
        dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'address' });
      } else if (!profile.has_contacts) {
        dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'contacts' });
      } else {
        dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'complete' });
      }

      // Load user addresses if profile exists
      if (profile) {
        await loadUserAddresses(userId);
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
      // Fallback to name setup if there's any error
      dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: 'name' });
    }
  }, [loadUserAddresses]);

  // Load user addresses
  const loadUserAddresses = useCallback(async (userId) => {
    try {
      const { data: addresses, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });

      if (error) throw error;

      dispatch({
        type: AuthActionTypes.SET_ADDRESSES,
        payload: addresses || []
      });
    } catch (error) {
      console.error('Error loading user addresses:', error);
    }
  }, []);

  // Send verification code
  const sendVerificationCode = useCallback(async (phoneNumber) => {
    dispatch({
      type: AuthActionTypes.SET_PHONE_VERIFICATION,
      payload: { isLoading: true, error: null, phoneNumber }
    });

    try {
      const result = await supabaseAuthService.sendVerificationCode(phoneNumber);
      
      if (result.success) {
        dispatch({
          type: AuthActionTypes.SET_PHONE_VERIFICATION,
          payload: { 
            isLoading: false,
            phoneNumber: result.phoneNumber
          }
        });
      } else {
        dispatch({
          type: AuthActionTypes.SET_PHONE_VERIFICATION,
          payload: { isLoading: false, error: result.error }
        });
      }
      
      return result;
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
  const verifyCode = useCallback(async (phoneNumber, code) => {
    dispatch({
      type: AuthActionTypes.SET_PHONE_VERIFICATION,
      payload: { isLoading: true, error: null }
    });

    try {
      const result = await supabaseAuthService.verifyCode(phoneNumber, code);
      
      if (result.success) {
        dispatch({
          type: AuthActionTypes.SET_PHONE_VERIFICATION,
          payload: { isLoading: false, phoneNumber: null }
        });
        
        // After successful verification, check user profile to determine onboarding step
        if (result.user?.uid) {
          await checkUserProfile(result.user.uid);
        }
      } else {
        dispatch({
          type: AuthActionTypes.SET_PHONE_VERIFICATION,
          payload: { isLoading: false, error: result.error }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error verifying code:', error);
      dispatch({
        type: AuthActionTypes.SET_PHONE_VERIFICATION,
        payload: { isLoading: false, error: error.message }
      });
      return { success: false, error: error.message };
    }
  }, [checkUserProfile]);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    if (!state.user?.uid) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Update profile in database
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: state.user.uid,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist - warn user but don't fail
          console.warn('⚠️  Database tables not set up. Profile updates will be skipped.');
          console.warn('See DATABASE_SETUP.md for setup instructions.');
          
          // Update auth metadata if display name changed
          if (updates.display_name) {
            await supabaseAuthService.updateUser({
              display_name: updates.display_name
            });
          }
          
          return { success: true, profile: { ...updates, id: state.user.uid } };
        }
        throw error;
      }

      dispatch({ type: AuthActionTypes.SET_PROFILE, payload: data });

      // Update auth metadata if display name changed
      if (updates.display_name) {
        await supabaseAuthService.updateUser({
          display_name: updates.display_name
        });
      }

      return { success: true, profile: data };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }, [state.user]);

  // Complete onboarding step
  const completeOnboardingStep = useCallback(async (step, data) => {
    try {
      const updates = {};
      
      switch (step) {
        case 'name':
          updates.display_name = data.displayName;
          break;
        case 'address':
          updates.has_address = true;
          break;
        case 'contacts':
          updates.has_contacts = true;
          break;
      }

      const result = await updateProfile(updates);
      
      if (result.success) {
        // Move to next step
        const nextStep = {
          name: 'address',
          address: 'contacts',
          contacts: 'complete'
        }[step];
        
        dispatch({ type: AuthActionTypes.SET_ONBOARDING_STEP, payload: nextStep });
      }
      
      return result;
    } catch (error) {
      console.error('Error completing onboarding step:', error);
      return { success: false, error: error.message };
    }
  }, [updateProfile]);

  // Create address
  const createAddress = useCallback(async (addressData) => {
    if (!state.user?.uid) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .insert({
          user_id: state.user.uid,
          name: addressData.name,
          formatted_address: addressData.formatted,
          latitude: addressData.coordinates.lat,
          longitude: addressData.coordinates.lng,
          place_id: addressData.placeId,
          tag: addressData.tag || 'home',
          is_default: addressData.isDefault || false,
        })
        .select()
        .single();

      if (error) throw error;

      // Reload addresses
      await loadUserAddresses(state.user.uid);
      
      return { success: true, address: data };
    } catch (error) {
      console.error('Error creating address:', error);
      return { success: false, error: error.message };
    }
  }, [state.user, loadUserAddresses]);

  // Update address
  const updateAddress = useCallback(async (addressId, addressData) => {
    if (!state.user?.uid) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .update({
          name: addressData.name,
          formatted_address: addressData.formatted,
          latitude: addressData.coordinates.lat,
          longitude: addressData.coordinates.lng,
          place_id: addressData.placeId,
          tag: addressData.tag || 'home',
          is_default: addressData.isDefault || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', addressId)
        .eq('user_id', state.user.uid)
        .select()
        .single();

      if (error) throw error;

      // Reload addresses
      await loadUserAddresses(state.user.uid);
      
      return { success: true, address: data };
    } catch (error) {
      console.error('Error updating address:', error);
      return { success: false, error: error.message };
    }
  }, [state.user, loadUserAddresses]);

  // Delete address
  const deleteAddress = useCallback(async (addressId) => {
    if (!state.user?.uid) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', state.user.uid);

      if (error) throw error;

      // Reload addresses
      await loadUserAddresses(state.user.uid);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting address:', error);
      return { success: false, error: error.message };
    }
  }, [state.user, loadUserAddresses]);

  // Logout
  const logout = useCallback(async () => {
    try {
      const result = await supabaseAuthService.signOut();
      if (result.success) {
        dispatch({ type: AuthActionTypes.RESET_STATE });
      }
      return result;
    } catch (error) {
      console.error('Error logging out:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: AuthActionTypes.CLEAR_ERROR });
  }, []);

  // Helper to check if user is fully onboarded
  const isFullyOnboarded = state.onboardingStep === 'complete';

  const value = {
    // State
    ...state,
    isFullyOnboarded,
    
    // Actions
    sendVerificationCode,
    verifyCode,
    updateProfile,
    completeOnboardingStep,
    createAddress,
    updateAddress,
    deleteAddress,
    logout,
    clearError,
    loadUserAddresses,
    checkUserProfile
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