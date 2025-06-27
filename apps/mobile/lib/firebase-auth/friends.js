import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  serverTimestamp,
  or,
  and
} from 'firebase/firestore';

/**
 * Get all friends for a user
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @returns {Array} Array of friend objects
 */
export async function getFriends(db, userId) {
  try {
    const friendshipsQuery = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', userId),
      where('status', '==', 'accepted')
    );
    
    const querySnapshot = await getDocs(friendshipsQuery);
    const friends = [];
    
    for (const friendshipDoc of querySnapshot.docs) {
      const friendship = friendshipDoc.data();
      const friendId = friendship.users.find(id => id !== userId);
      
      // Get friend's profile
      const friendRef = doc(db, 'users', friendId);
      const friendSnap = await getDoc(friendRef);
      
      if (friendSnap.exists()) {
        friends.push({
          id: friendId,
          ...friendSnap.data(),
          friendshipId: friendshipDoc.id,
          friendsSince: friendship.createdAt
        });
      }
    }
    
    return friends;
  } catch (error) {
    console.error('Error getting friends:', error);
    throw error;
  }
}

/**
 * Get friend requests for a user
 * @param {Object} db - Firestore instance  
 * @param {string} userId - User ID
 * @param {string} direction - 'incoming', 'outgoing', or 'all'
 * @param {string} status - Request status filter
 * @returns {Array} Array of friend request objects
 */
export async function getFriendRequests(db, userId, direction = 'all', status = 'pending') {
  try {
    let friendRequestsQuery;
    
    if (direction === 'incoming') {
      friendRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('recipientId', '==', userId),
        where('status', '==', status)
      );
    } else if (direction === 'outgoing') {
      friendRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', userId),
        where('status', '==', status)
      );
    } else {
      friendRequestsQuery = query(
        collection(db, 'friendRequests'),
        or(
          where('recipientId', '==', userId),
          where('senderId', '==', userId)
        ),
        where('status', '==', status)
      );
    }
    
    const querySnapshot = await getDocs(friendRequestsQuery);
    const requests = [];
    
    for (const requestDoc of querySnapshot.docs) {
      const request = requestDoc.data();
      const isIncoming = request.recipientId === userId;
      const otherUserId = isIncoming ? request.senderId : request.recipientId;
      
      // Get other user's profile
      const userRef = doc(db, 'users', otherUserId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        requests.push({
          id: requestDoc.id,
          ...request,
          direction: isIncoming ? 'incoming' : 'outgoing',
          [isIncoming ? 'senderName' : 'recipientName']: userData.displayName,
          [isIncoming ? 'senderPhotoURL' : 'recipientPhotoURL']: userData.photoURL
        });
      }
    }
    
    return requests;
  } catch (error) {
    console.error('Error getting friend requests:', error);
    throw error;
  }
}

/**
 * Send a friend request
 * @param {Object} db - Firestore instance
 * @param {string} senderId - Sender's user ID
 * @param {string} recipientId - Recipient's user ID
 * @param {string} message - Optional message
 * @returns {string} Request ID
 */
export async function sendFriendRequest(db, senderId, recipientId, message = '') {
  try {
    // Check if users are already friends
    const existingFriendshipQuery = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', senderId)
    );
    
    const friendshipSnapshot = await getDocs(existingFriendshipQuery);
    const alreadyFriends = friendshipSnapshot.docs.some(doc => 
      doc.data().users.includes(recipientId)
    );
    
    if (alreadyFriends) {
      throw new Error('Users are already friends');
    }
    
    // Check if there's already a pending request
    const existingRequestQuery = query(
      collection(db, 'friendRequests'),
      or(
        and(
          where('senderId', '==', senderId),
          where('recipientId', '==', recipientId)
        ),
        and(
          where('senderId', '==', recipientId),
          where('recipientId', '==', senderId)
        )
      ),
      where('status', '==', 'pending')
    );
    
    const requestSnapshot = await getDocs(existingRequestQuery);
    if (!requestSnapshot.empty) {
      throw new Error('Friend request already exists');
    }
    
    // Create the friend request
    const requestData = {
      senderId,
      recipientId,
      message,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'friendRequests'), requestData);
    return docRef.id;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
}

/**
 * Accept a friend request
 * @param {Object} db - Firestore instance
 * @param {string} requestId - Friend request ID
 * @returns {Object} Result object
 */
export async function acceptFriendRequest(db, requestId) {
  try {
    // Get the friend request
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }
    
    const request = requestSnap.data();
    
    if (request.status !== 'pending') {
      throw new Error('Friend request is not pending');
    }
    
    // Create friendship
    const friendshipData = {
      users: [request.senderId, request.recipientId],
      status: 'accepted',
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'friendships'), friendshipData);
    
    // Update request status
    await updateDoc(requestRef, {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
}

/**
 * Reject a friend request
 * @param {Object} db - Firestore instance
 * @param {string} requestId - Friend request ID
 */
export async function rejectFriendRequest(db, requestId) {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
}

/**
 * Cancel a friend request
 * @param {Object} db - Firestore instance
 * @param {string} requestId - Friend request ID
 * @param {string} userId - User ID (to verify ownership)
 */
export async function cancelFriendRequest(db, requestId, userId) {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }
    
    const request = requestSnap.data();
    
    if (request.senderId !== userId) {
      throw new Error('Not authorized to cancel this request');
    }
    
    await deleteDoc(requestRef);
  } catch (error) {
    console.error('Error canceling friend request:', error);
    throw error;
  }
}

/**
 * Remove a friendship
 * @param {Object} db - Firestore instance
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 */
export async function removeFriend(db, userId1, userId2) {
  try {
    const friendshipsQuery = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', userId1)
    );
    
    const querySnapshot = await getDocs(friendshipsQuery);
    
    for (const friendshipDoc of querySnapshot.docs) {
      const friendship = friendshipDoc.data();
      if (friendship.users.includes(userId2)) {
        await deleteDoc(friendshipDoc.ref);
        break;
      }
    }
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
}

/**
 * Search for users by email or display name
 * @param {Object} db - Firestore instance
 * @param {string} searchTerm - Search term
 * @param {string} currentUserId - Current user's ID (to exclude from results)
 * @param {number} limitCount - Maximum results to return
 * @returns {Array} Array of user objects
 */
export async function searchUsers(db, searchTerm, currentUserId, limitCount = 10) {
  try {
    const searchLower = searchTerm.toLowerCase();
    
    // Search by display name (case-insensitive)
    const nameQuery = query(
      collection(db, 'users'),
      where('displayNameLower', '>=', searchLower),
      where('displayNameLower', '<=', searchLower + '\uf8ff'),
      limit(limitCount)
    );
    
    // Search by email
    const emailQuery = query(
      collection(db, 'users'),
      where('email', '==', searchTerm),
      limit(limitCount)
    );
    
    const [nameResults, emailResults] = await Promise.all([
      getDocs(nameQuery),
      getDocs(emailQuery)
    ]);
    
    const users = new Map();
    
    // Add name search results
    nameResults.docs.forEach(doc => {
      if (doc.id !== currentUserId) {
        users.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });
    
    // Add email search results
    emailResults.docs.forEach(doc => {
      if (doc.id !== currentUserId) {
        users.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });
    
    return Array.from(users.values());
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
} 