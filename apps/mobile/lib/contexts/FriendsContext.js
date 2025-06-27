import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { db } from '../firebase-auth/config';
import { useAuth } from './AuthContext';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  searchUsers
} from '../firebase-auth/friends';

// Initial state
const initialState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  loading: false,
  error: null,
  lastUpdated: null
};

// Action types
const FriendsActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_FRIENDS: 'SET_FRIENDS',
  SET_INCOMING_REQUESTS: 'SET_INCOMING_REQUESTS',
  SET_OUTGOING_REQUESTS: 'SET_OUTGOING_REQUESTS',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET_STATE: 'RESET_STATE'
};

// Reducer
function friendsReducer(state, action) {
  switch (action.type) {
    case FriendsActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    case FriendsActionTypes.SET_FRIENDS:
      return { ...state, friends: action.payload, loading: false, lastUpdated: new Date() };
    case FriendsActionTypes.SET_INCOMING_REQUESTS:
      return { ...state, incomingRequests: action.payload };
    case FriendsActionTypes.SET_OUTGOING_REQUESTS:
      return { ...state, outgoingRequests: action.payload, loading: false, lastUpdated: new Date() };
    case FriendsActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case FriendsActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    case FriendsActionTypes.RESET_STATE:
      return initialState;
    default:
      return state;
  }
}

// Create context
const FriendsContext = createContext(null);

// Provider component
export function FriendsProvider({ children }) {
  const [state, dispatch] = useReducer(friendsReducer, initialState);
  const { user } = useAuth();

  // Reset state when user logs out
  React.useEffect(() => {
    if (!user) {
      dispatch({ type: FriendsActionTypes.RESET_STATE });
    }
  }, [user]);

  // Load friends
  const loadFriends = useCallback(async () => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });
    
    try {
      const friendsList = await getFriends(db, user.uid);
      dispatch({
        type: FriendsActionTypes.SET_FRIENDS,
        payload: friendsList
      });
    } catch (error) {
      console.error('Error loading friends:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
    }
  }, [user]);

  // Load friend requests
  const loadFriendRequests = useCallback(async () => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });
    
    try {
      const allRequests = await getFriendRequests(db, user.uid, 'all', 'pending');
      
      const incoming = allRequests.filter(request => request.direction === 'incoming');
      const outgoing = allRequests.filter(request => request.direction === 'outgoing');
      
      dispatch({
        type: FriendsActionTypes.SET_INCOMING_REQUESTS,
        payload: incoming
      });
      dispatch({
        type: FriendsActionTypes.SET_OUTGOING_REQUESTS,
        payload: outgoing
      });
    } catch (error) {
      console.error('Error loading friend requests:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
    }
  }, [user]);

  // Send friend request
  const sendRequest = useCallback(async (recipientId, message = '') => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });

    try {
      const requestId = await sendFriendRequest(db, user.uid, recipientId, message);
      
      // Reload friend requests to show the new request
      await loadFriendRequests();
      
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadFriendRequests]);

  // Accept friend request
  const acceptRequest = useCallback(async (requestId) => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });

    try {
      await acceptFriendRequest(db, requestId);
      
      // Reload both friends and friend requests
      await Promise.all([
        loadFriends(),
        loadFriendRequests()
      ]);
      
      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadFriends, loadFriendRequests]);

  // Reject friend request
  const rejectRequest = useCallback(async (requestId) => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });

    try {
      await rejectFriendRequest(db, requestId);
      
      // Reload friend requests
      await loadFriendRequests();
      
      return true;
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadFriendRequests]);

  // Cancel outgoing request
  const cancelRequest = useCallback(async (requestId) => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });

    try {
      await cancelFriendRequest(db, requestId, user.uid);
      
      // Reload friend requests
      await loadFriendRequests();
      
      return true;
    } catch (error) {
      console.error('Error canceling friend request:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadFriendRequests]);

  // Remove friend
  const removeUserFriend = useCallback(async (friendId) => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: FriendsActionTypes.SET_LOADING, payload: true });

    try {
      await removeFriend(db, user.uid, friendId);
      
      // Reload friends list
      await loadFriends();
      
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadFriends]);

  // Search for users
  const searchForUsers = useCallback(async (searchTerm, limit = 10) => {
    if (!user) {
      dispatch({
        type: FriendsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return [];
    }

    try {
      const results = await searchUsers(db, searchTerm, user.uid, limit);
      return results;
    } catch (error) {
      console.error('Error searching for users:', error);
      return [];
    }
  }, [user]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: FriendsActionTypes.CLEAR_ERROR });
  }, []);

  const value = {
    // State
    ...state,
    
    // Actions
    loadFriends,
    loadFriendRequests,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend: removeUserFriend,
    searchForUsers,
    clearError
  };

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
}

// Hook to use friends context
export function useFriends() {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
}

export default FriendsContext; 