// apps/web/src/lib/stores/friends.js
import { writable, derived, get } from 'svelte/store';
import { getFirestore } from 'firebase/firestore';
import { authStore } from './auth';
import { 
  getFriends, 
  getFriendRequests, 
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  searchUsers
} from '$firebase-auth/friends';

// Initial state
const initialState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  loading: false,
  error: null,
  lastUpdated: null
};

// Create the store
const friendsStore = writable(initialState);

// Create derived stores for convenience
export const friends = derived(friendsStore, $store => $store.friends);
export const incomingRequests = derived(friendsStore, $store => $store.incomingRequests);
export const outgoingRequests = derived(friendsStore, $store => $store.outgoingRequests);
export const isLoading = derived(friendsStore, $store => $store.loading);
export const error = derived(friendsStore, $store => $store.error);

// Reset store when user logs out
authStore.subscribe(auth => {
  if (!auth.user) {
    friendsStore.set(initialState);
  }
});

/**
 * Load all friends for the current user
 */
export async function loadFriends() {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const friendsList = await getFriends(db, auth.user.uid);
    
    friendsStore.update(state => ({
      ...state,
      friends: friendsList,
      loading: false,
      lastUpdated: new Date()
    }));
  } catch (error) {
    console.error('Error loading friends:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
  }
}

/**
 * Load friend requests for the current user
 */
export async function loadFriendRequests() {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const allRequests = await getFriendRequests(db, auth.user.uid, 'all', 'pending');
    
    const incoming = allRequests.filter(request => request.direction === 'incoming');
    const outgoing = allRequests.filter(request => request.direction === 'outgoing');
    
    friendsStore.update(state => ({
      ...state,
      incomingRequests: incoming,
      outgoingRequests: outgoing,
      loading: false,
      lastUpdated: new Date()
    }));
  } catch (error) {
    console.error('Error loading friend requests:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
  }
}

/**
 * Send a friend request to another user
 * @param {string} recipientId - ID of the user to send request to
 * @param {string} message - Optional message to include
 */
export async function sendRequest(recipientId, message = '') {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const requestId = await sendFriendRequest(db, auth.user.uid, recipientId, message);
    
    // Get recipient details to display in the UI
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    const recipientName = recipientDoc.exists ? recipientDoc.data().displayName : 'User';
    
    // Add to outgoing requests in store
    friendsStore.update(state => {
      const newRequest = {
        id: requestId,
        senderId: auth.user.uid,
        recipientId,
        status: 'pending',
        message,
        createdAt: new Date(),
        direction: 'outgoing',
        recipientName
      };
      
      return {
        ...state,
        outgoingRequests: [newRequest, ...state.outgoingRequests],
        loading: false,
        lastUpdated: new Date()
      };
    });
    
    return true;
  } catch (error) {
    console.error('Error sending friend request:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Accept a friend request
 * @param {string} requestId - ID of the friend request
 */
export async function acceptRequest(requestId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const result = await acceptFriendRequest(db, requestId);
    
    // Update stores - remove from requests and add to friends
    friendsStore.update(state => {
      // Find the request to get the sender details
      const request = state.incomingRequests.find(req => req.id === requestId);
      
      if (!request) {
        return {
          ...state,
          loading: false,
          lastUpdated: new Date()
        };
      }
      
      // Find if we already have this friend in our list
      const existingFriendIndex = state.friends.findIndex(f => f.id === request.senderId);
      
      // Create new friend entry if not already in list
      let updatedFriends = [...state.friends];
      
      if (existingFriendIndex === -1) {
        updatedFriends.push({
          id: request.senderId,
          displayName: request.senderName || 'User',
          photoURL: null, // We don't have this in the request
        });
      }
      
      return {
        ...state,
        friends: updatedFriends,
        incomingRequests: state.incomingRequests.filter(req => req.id !== requestId),
        loading: false,
        lastUpdated: new Date()
      };
    });
    
    // Reload friends to get full profile
    await loadFriends();
    
    return true;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Reject a friend request
 * @param {string} requestId - ID of the friend request
 */
export async function rejectRequest(requestId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    await rejectFriendRequest(db, requestId);
    
    // Update store - remove from incoming requests
    friendsStore.update(state => ({
      ...state,
      incomingRequests: state.incomingRequests.filter(req => req.id !== requestId),
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Cancel an outgoing friend request
 * @param {string} requestId - ID of the friend request
 */
export async function cancelRequest(requestId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    await cancelFriendRequest(db, requestId, auth.user.uid);
    
    // Update store - remove from outgoing requests
    friendsStore.update(state => ({
      ...state,
      outgoingRequests: state.outgoingRequests.filter(req => req.id !== requestId),
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error canceling friend request:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Remove a friend
 * @param {string} friendId - ID of the friend to remove
 */
export async function removeUserFriend(friendId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    friendsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  friendsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    await removeFriend(db, auth.user.uid, friendId);
    
    // Update store - remove from friends list
    friendsStore.update(state => ({
      ...state,
      friends: state.friends.filter(friend => friend.id !== friendId),
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error removing friend:', error);
    friendsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Search for users to add as friends
 * @param {string} searchTerm - Email or display name to search for
 * @param {number} limit - Maximum number of results
 */
export async function searchForUsers(searchTerm, limit = 10) {
  const auth = get(authStore);
  
  if (!auth.user) {
    return [];
  }
  
  try {
    const db = getFirestore();
    const results = await searchUsers(db, searchTerm, auth.user.uid, limit);
    return results;
  } catch (error) {
    console.error('Error searching for users:', error);
    return [];
  }
}

// Export the store itself
export { friendsStore };