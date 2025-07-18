import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { findOptimalMeetingPoint } from '../services/meetingPointApi';
import { useAuth } from './AuthContext';

// Initial state
const initialState = {
  meetingPointCache: new Map(),
  meetingPointCacheKey: null,
  isCalculatingMeetingPoint: false,
  currentMeetingPoint: null,
  currentAttendeeAddresses: []
};

// Action types
const MeetingPointActionTypes = {
  SET_MEETING_POINT_CACHE: 'SET_MEETING_POINT_CACHE',
  SET_MEETING_POINT_CACHE_KEY: 'SET_MEETING_POINT_CACHE_KEY',
  SET_CALCULATING_MEETING_POINT: 'SET_CALCULATING_MEETING_POINT',
  CLEAR_MEETING_POINT_CACHE: 'CLEAR_MEETING_POINT_CACHE',
  SET_CURRENT_MEETING_POINT: 'SET_CURRENT_MEETING_POINT',
  SET_CURRENT_ATTENDEE_ADDRESSES: 'SET_CURRENT_ATTENDEE_ADDRESSES'
};

// Reducer
function meetingPointReducer(state, action) {
  switch (action.type) {
    case MeetingPointActionTypes.SET_MEETING_POINT_CACHE:
      return { 
        ...state, 
        meetingPointCache: action.payload,
        isCalculatingMeetingPoint: false
      };
    case MeetingPointActionTypes.SET_MEETING_POINT_CACHE_KEY:
      return { ...state, meetingPointCacheKey: action.payload };
    case MeetingPointActionTypes.SET_CALCULATING_MEETING_POINT:
      return { ...state, isCalculatingMeetingPoint: action.payload };
    case MeetingPointActionTypes.CLEAR_MEETING_POINT_CACHE:
      return { 
        ...state, 
        meetingPointCache: new Map(),
        meetingPointCacheKey: null,
        isCalculatingMeetingPoint: false
      };
    case MeetingPointActionTypes.SET_CURRENT_MEETING_POINT:
      return { ...state, currentMeetingPoint: action.payload };
    case MeetingPointActionTypes.SET_CURRENT_ATTENDEE_ADDRESSES:
      return { ...state, currentAttendeeAddresses: action.payload };
    default:
      return state;
  }
}

// Create context
const MeetingPointContext = createContext(null);

// Provider component
export function MeetingPointProvider({ children }) {
  const [state, dispatch] = useReducer(meetingPointReducer, initialState);
  const { addresses } = useAuth();

  // Clear meeting point cache when addresses change
  React.useEffect(() => {
    if (addresses && state.meetingPointCache.size > 0) {
      dispatch({ type: MeetingPointActionTypes.CLEAR_MEETING_POINT_CACHE });
    }
  }, [addresses]);

  // Generate cache key for meeting point calculation
  const generateMeetingPointCacheKey = useCallback((members, addresses) => {
    if (!members?.length || !addresses) return null;
    
    const attendees = members.filter(m => m.attendance?.isAttending);
    if (attendees.length < 2) return null;
    
    // Create a sorted array of attendee addresses for consistent cache key
    const attendeeAddresses = attendees.map(attendee => {
      if (attendee.type === 'custom_location') {
        return {
          id: attendee.id,
          type: 'custom_location',
          lat: attendee.coordinates?.[1],
          lng: attendee.coordinates?.[0],
          address: attendee.address
        };
      } else if (attendee.is_me) {
        const userAddress = addresses.find(a => a.is_default) || addresses[0];
        return {
          id: attendee.id,
          type: 'user',
          lat: userAddress?.latitude,
          lng: userAddress?.longitude,
          address: userAddress?.formatted_address || userAddress?.name
        };
      } else if (attendee.user_id) {
        // For other users, we'll use their user_id as part of the cache key
        // The actual addresses will be fetched during calculation
        return {
          id: attendee.id,
          type: 'user',
          userId: attendee.user_id
        };
      }
      return null;
    }).filter(Boolean);
    
    // Sort by ID for consistent cache key
    attendeeAddresses.sort((a, b) => a.id.localeCompare(b.id));
    
    // Create cache key from sorted addresses
    const cacheKey = attendeeAddresses.map(addr => {
      if (addr.type === 'user' && addr.userId) {
        // For users without known addresses, use user ID
        return `${addr.id}:${addr.type}:${addr.userId}`;
      } else {
        // For known addresses, use coordinates
        return `${addr.id}:${addr.type}:${addr.lat?.toFixed(4) || 'unknown'}:${addr.lng?.toFixed(4) || 'unknown'}`;
      }
    }).join('|');
    
    return cacheKey;
  }, []);

  // Check cache synchronously (for immediate UI updates)
  const getCachedMeetingPoint = useCallback((members, addresses) => {
    if (!members?.length || !addresses) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }
    
    const attendees = members.filter(m => m.attendance?.isAttending);
    if (attendees.length < 2) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }
    
    const cacheKey = generateMeetingPointCacheKey(members, addresses);
    if (!cacheKey) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }
    
    // Check if we have a cached result
    if (state.meetingPointCache.has(cacheKey)) {
      const cachedResult = state.meetingPointCache.get(cacheKey);
      const cacheAge = Date.now() - (cachedResult.timestamp || 0);
      const maxAge = 30 * 60 * 1000; // 30 minutes
      
      if (cacheAge < maxAge) {
        return { meetingPoint: cachedResult.meetingPoint, attendeeAddresses: cachedResult.attendeeAddresses };
      }
    }
    
    return null; // No valid cache found
  }, [state.meetingPointCache, generateMeetingPointCacheKey]);

  // Calculate meeting point with caching
  const calculateMeetingPoint = useCallback(async (members, addresses, getGroupMemberAddresses) => {
    if (!members?.length || !addresses) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }
    
    const attendees = members.filter(m => m.attendance?.isAttending);
    if (attendees.length < 2) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }
    
    // Generate cache key
    const cacheKey = generateMeetingPointCacheKey(members, addresses);
    if (!cacheKey) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }
    
    
    // Check if we have a cached result
    if (state.meetingPointCache.has(cacheKey)) {
      const cachedResult = state.meetingPointCache.get(cacheKey);
      const cacheAge = Date.now() - (cachedResult.timestamp || 0);
      const maxAge = 30 * 60 * 1000; // 30 minutes
      
      if (cacheAge < maxAge) {
        return { meetingPoint: cachedResult.meetingPoint, attendeeAddresses: cachedResult.attendeeAddresses };
      } else {
        // Remove expired cache entry
        const newCache = new Map(state.meetingPointCache);
        newCache.delete(cacheKey);
        dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
      }
    }
    
    // Set cache key and calculating state
    dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE_KEY, payload: cacheKey });
    dispatch({ type: MeetingPointActionTypes.SET_CALCULATING_MEETING_POINT, payload: true });
    
    try {
      // Get member addresses
      const userAddressesMap = await getGroupMemberAddresses();
      const addressesArr = [];
      
      for (const attendee of attendees) {
        if (attendee.type === 'custom_location') {
          if (attendee.coordinates && attendee.coordinates.length >= 2) {
            addressesArr.push({
              address: attendee.address || attendee.display_name,
              lat: attendee.coordinates[1],
              lng: attendee.coordinates[0],
              name: attendee.display_name,
              type: 'custom_location',
            });
          }
        } else if (attendee.is_me) {
          const userAddress = addresses?.find(a => a.is_default) || addresses?.[0];
          if (userAddress) {
            addressesArr.push({
              address: userAddress.formatted_address || userAddress.name || `${userAddress.latitude}, ${userAddress.longitude}`,
              lat: userAddress.latitude,
              lng: userAddress.longitude,
              name: attendee.display_name || 'You',
              type: 'user',
            });
          }
        } else if (attendee.user_id) {
          const userAddress = userAddressesMap[attendee.user_id];
          if (userAddress) {
            addressesArr.push({
              address: userAddress.address,
              lat: userAddress.latitude,
              lng: userAddress.longitude,
              name: attendee.display_name || 'User',
              type: 'user',
            });
          } else {
            // Fallback to current user's address with offset
            const currentUserAddress = addresses?.find(a => a.is_default) || addresses?.[0];
            if (currentUserAddress) {
              const latOffset = (Math.random() - 0.5) * 0.02;
              const lngOffset = (Math.random() - 0.5) * 0.02;
              addressesArr.push({
                address: `${attendee.display_name}'s Location (estimated)`,
                lat: currentUserAddress.latitude + latOffset,
                lng: currentUserAddress.longitude + lngOffset,
                name: attendee.display_name || 'User',
                type: 'user',
              });
            }
          }
        }
      }
      
      if (addressesArr.length < 2) {
        const result = { meetingPoint: null, attendeeAddresses: [] };
        // Cache the result
        const newCache = new Map(state.meetingPointCache);
        newCache.set(cacheKey, { ...result, timestamp: Date.now() });
        dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
        return result;
      }
      
      const apiAddresses = addressesArr.filter(a => a.address && a.lat && a.lng).map((a, i) => ({
        id: `addr-${i}`,
        value: a.address,
        coordinates: [a.lng, a.lat],
      }));
      
      if (apiAddresses.length < 2) {
        const result = { meetingPoint: null, attendeeAddresses: addressesArr };
        // Cache the result
        const newCache = new Map(state.meetingPointCache);
        newCache.set(cacheKey, { ...result, timestamp: Date.now() });
        dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
        return result;
      }
      
      const meetingPointResult = await findOptimalMeetingPoint(apiAddresses, {
        transportation_mode: 'transit',
        venue_types: ['restaurant', 'cafe', 'bar'],
        search_radius: 1000,
      });
      
      const result = { meetingPoint: meetingPointResult, attendeeAddresses: addressesArr };
      
      // Cache the result
      const newCache = new Map(state.meetingPointCache);
      newCache.set(cacheKey, { ...result, timestamp: Date.now() });
      dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
      

      return result;
    } catch (error) {
      
      const result = { meetingPoint: null, attendeeAddresses: [] };
      // Cache the error result to avoid repeated failed calls
      const newCache = new Map(state.meetingPointCache);
      newCache.set(cacheKey, { ...result, timestamp: Date.now() });
      dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });

      return result;
    }
  }, [state.meetingPointCache, generateMeetingPointCacheKey]);

  // Calculate meeting point for standalone addresses (main page use case)
  const calculateStandaloneMeetingPoint = useCallback(async (addresses, options = {}) => {
    if (!addresses?.length || addresses.length < 2) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }

    // Generate cache key for standalone addresses - order independent
    const validAddresses = addresses.filter(addr => addr.value && addr.coordinates);
    if (validAddresses.length < 2) {
      return { meetingPoint: null, attendeeAddresses: [] };
    }

    // Create a sorted array of address signatures for consistent cache key
    const addressSignatures = validAddresses.map(addr => ({
      value: addr.value,
      lat: addr.coordinates[1]?.toFixed(4),
      lng: addr.coordinates[0]?.toFixed(4)
    }));

    // Sort by coordinates first, then by value for consistent ordering
    addressSignatures.sort((a, b) => {
      if (a.lat !== b.lat) return a.lat.localeCompare(b.lat);
      if (a.lng !== b.lng) return a.lng.localeCompare(b.lng);
      return a.value.localeCompare(b.value);
    });

    const cacheKey = addressSignatures
      .map(addr => `${addr.value}:${addr.lat}:${addr.lng}`)
      .join('|');

    // Check if we have a cached result
    if (state.meetingPointCache.has(cacheKey)) {
      const cachedResult = state.meetingPointCache.get(cacheKey);
      const cacheAge = Date.now() - (cachedResult.timestamp || 0);
      const maxAge = 30 * 60 * 1000; // 30 minutes

      if (cacheAge < maxAge) {
        return cachedResult;
      } else {
        // Remove expired cache entry
        const newCache = new Map(state.meetingPointCache);
        newCache.delete(cacheKey);
        dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
      }
    }
    // Set cache key and calculating state
    dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE_KEY, payload: cacheKey });
    dispatch({ type: MeetingPointActionTypes.SET_CALCULATING_MEETING_POINT, payload: true });

    try {
      // Format addresses for API
      const apiAddresses = validAddresses.map((addr, i) => ({
        id: `addr-${i}`,
        value: addr.value,
        coordinates: addr.coordinates,
      }));

      // Default options
      const defaultOptions = {
        transportation_mode: 'transit',
        venue_types: ['restaurant', 'cafe', 'bar'],
        search_radius: 1000,
        showVenues: true
      };

      const finalOptions = { ...defaultOptions, ...options };

      const meetingPointResult = await findOptimalMeetingPoint(apiAddresses, finalOptions);

      // Format result for consistency
      const result = {
        meetingPoint: meetingPointResult,
        attendeeAddresses: validAddresses.map(addr => ({
          address: addr.value,
          lat: addr.coordinates[1],
          lng: addr.coordinates[0],
          name: addr.value,
          type: 'standalone'
        }))
      };

      // Cache the result
      const newCache = new Map(state.meetingPointCache);
      newCache.set(cacheKey, { ...result, timestamp: Date.now() });
      dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });

      return result;
    } catch (error) {
      const result = { meetingPoint: null, attendeeAddresses: [] };
      // Cache the error result to avoid repeated failed calls
      const newCache = new Map(state.meetingPointCache);
      newCache.set(cacheKey, { ...result, timestamp: Date.now() });
      dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
      return result;
    }
  }, [state.meetingPointCache]);

  // Check cache for standalone addresses
  const getCachedStandaloneMeetingPoint = useCallback((addresses) => {
    if (!addresses?.length || addresses.length < 2) {
      return null;
    }

    // Generate cache key for standalone addresses - order independent
    const validAddresses = addresses.filter(addr => addr.value && addr.coordinates);
    if (validAddresses.length < 2) {
      return null;
    }

    // Create a sorted array of address signatures for consistent cache key
    const addressSignatures = validAddresses.map(addr => ({
      value: addr.value,
      lat: addr.coordinates[1]?.toFixed(4),
      lng: addr.coordinates[0]?.toFixed(4)
    }));

    // Sort by coordinates first, then by value for consistent ordering
    addressSignatures.sort((a, b) => {
      if (a.lat !== b.lat) return a.lat.localeCompare(b.lat);
      if (a.lng !== b.lng) return a.lng.localeCompare(b.lng);
      return a.value.localeCompare(b.value);
    });

    const cacheKey = addressSignatures
      .map(addr => `${addr.value}:${addr.lat}:${addr.lng}`)
      .join('|');

    // Check if we have a cached result
    if (state.meetingPointCache.has(cacheKey)) {
      const cachedResult = state.meetingPointCache.get(cacheKey);
      const cacheAge = Date.now() - (cachedResult.timestamp || 0);
      const maxAge = 30 * 60 * 1000; // 30 minutes

      if (cacheAge < maxAge) {
        return cachedResult;
      }
    }

    return null; // No valid cache found
  }, [state.meetingPointCache]);

  // Clear meeting point cache
  const clearMeetingPointCache = useCallback(() => {
    dispatch({ type: MeetingPointActionTypes.CLEAR_MEETING_POINT_CACHE });
  }, []);

  // Force recalculation for a specific group by clearing its cache
  const forceMeetingPointRecalculation = useCallback(async (members, addresses, getGroupMemberAddresses) => {
    if (!members?.length || !addresses) return { meetingPoint: null, attendeeAddresses: [] };
    
    const cacheKey = generateMeetingPointCacheKey(members, addresses);
    if (cacheKey) {
      // Remove the specific cache entry
      const newCache = new Map(state.meetingPointCache);
      newCache.delete(cacheKey);
      dispatch({ type: MeetingPointActionTypes.SET_MEETING_POINT_CACHE, payload: newCache });
    }
    
    // Recalculate
    return calculateMeetingPoint(members, addresses, getGroupMemberAddresses);
  }, [state.meetingPointCache, generateMeetingPointCacheKey, calculateMeetingPoint]);

  // Check if meeting point is immediately available in cache
  const isMeetingPointCached = useCallback((members, addresses) => {
    const cachedResult = getCachedMeetingPoint(members, addresses);
    return cachedResult !== null;
  }, [getCachedMeetingPoint]);

  // Get cache statistics for debugging
  const getMeetingPointCacheStats = useCallback(() => {
    const cacheSize = state.meetingPointCache.size;
    const currentTime = Date.now();
    const expiredEntries = Array.from(state.meetingPointCache.entries())
      .filter(([_, result]) => {
        const cacheAge = currentTime - (result.timestamp || 0);
        return cacheAge > 30 * 60 * 1000; // 30 minutes
      }).length;
    
    return {
      cacheSize,
      expiredEntries,
      currentCacheKey: state.meetingPointCacheKey,
      isCalculating: state.isCalculatingMeetingPoint
    };
  }, [state.meetingPointCache, state.meetingPointCacheKey, state.isCalculatingMeetingPoint]);

  const value = {
    // State
    ...state,
    
    // Actions
    calculateMeetingPoint,
    getCachedMeetingPoint,
    clearMeetingPointCache,
    forceMeetingPointRecalculation,
    isMeetingPointCached,
    getMeetingPointCacheStats,
    calculateStandaloneMeetingPoint,
    getCachedStandaloneMeetingPoint
  };

  return (
    <MeetingPointContext.Provider value={value}>
      {children}
    </MeetingPointContext.Provider>
  );
}

// Hook to use meeting point context
export function useMeetingPoint() {
  const context = useContext(MeetingPointContext);
  if (!context) {
    throw new Error('useMeetingPoint must be used within a MeetingPointProvider');
  }
  return context;
}

export default MeetingPointContext; 