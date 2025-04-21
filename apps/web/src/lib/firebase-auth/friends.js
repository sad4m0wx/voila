// packages/firebase-auth/friends.js
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    query, 
    where, 
    arrayUnion, 
    arrayRemove, 
    serverTimestamp, 
    deleteDoc,
    orderBy
  } from 'firebase/firestore';
  
  /**
   * Send a friend request to another user
   * @param {Object} db - Firestore instance
   * @param {string} senderId - User ID of the sender
   * @param {string} recipientId - User ID of the recipient
   * @param {string} message - Optional message to send with request
   */
  export async function sendFriendRequest(db, senderId, recipientId, message = '') {
    // Don't allow sending friend request to yourself
    if (senderId === recipientId) {
      throw new Error('You cannot send a friend request to yourself');
    }
    
    // Check if recipient exists
    const recipientRef = doc(db, 'users', recipientId);
    const recipientSnap = await getDoc(recipientRef);
    
    if (!recipientSnap.exists()) {
      throw new Error('User not found');
    }
    
    // Check if they are already friends
    const senderRef = doc(db, 'users', senderId);
    const senderSnap = await getDoc(senderRef);
    
    if (senderSnap.exists() && senderSnap.data().friends && senderSnap.data().friends.includes(recipientId)) {
      throw new Error('You are already friends with this user');
    }
    
    // Check if a request already exists
    const requestsRef = collection(db, 'friendRequests');
    const existingRequestQuery = query(
      requestsRef,
      where('senderId', '==', senderId),
      where('recipientId', '==', recipientId),
      where('status', '==', 'pending')
    );
    
    const recipientRequestQuery = query(
      requestsRef,
      where('senderId', '==', recipientId),
      where('recipientId', '==', senderId),
      where('status', '==', 'pending')
    );
    
    const existingRequestSnap = await getDocs(existingRequestQuery);
    const recipientRequestSnap = await getDocs(recipientRequestQuery);
    
    if (!existingRequestSnap.empty) {
      throw new Error('You already sent a friend request to this user');
    }
    
    if (!recipientRequestSnap.empty) {
      throw new Error('This user has already sent you a friend request');
    }
    
    // Create a new friend request
    const requestRef = doc(collection(db, 'friendRequests'));
    
    await setDoc(requestRef, {
      id: requestRef.id,
      senderId,
      recipientId,
      message,
      senderName: senderSnap.data().displayName || 'A user',
      recipientName: recipientSnap.data().displayName || 'A user',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return requestRef.id;
  }
  
  /**
   * Accept a friend request
   * @param {Object} db - Firestore instance
   * @param {string} requestId - ID of the friend request
   */
  export async function acceptFriendRequest(db, requestId) {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }
    
    const request = requestSnap.data();
    
    if (request.status !== 'pending') {
      throw new Error('This request has already been processed');
    }
    
    // Update the request status
    await updateDoc(requestRef, {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
    
    // Add each user to the other's friends list
    const senderRef = doc(db, 'users', request.senderId);
    const recipientRef = doc(db, 'users', request.recipientId);
    
    // Update sender's friends list
    await updateDoc(senderRef, {
      friends: arrayUnion(request.recipientId),
      updatedAt: serverTimestamp()
    });
    
    // Update recipient's friends list
    await updateDoc(recipientRef, {
      friends: arrayUnion(request.senderId),
      updatedAt: serverTimestamp()
    });
    
    return {
      requestId,
      senderId: request.senderId,
      recipientId: request.recipientId
    };
  }
  
  /**
   * Reject a friend request
   * @param {Object} db - Firestore instance
   * @param {string} requestId - ID of the friend request
   */
  export async function rejectFriendRequest(db, requestId) {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }
    
    const request = requestSnap.data();
    
    if (request.status !== 'pending') {
      throw new Error('This request has already been processed');
    }
    
    // Update the request status
    await updateDoc(requestRef, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
    
    return requestId;
  }
  
  /**
   * Cancel a friend request you sent
   * @param {Object} db - Firestore instance
   * @param {string} requestId - ID of the friend request
   * @param {string} userId - ID of the user canceling the request
   */
  export async function cancelFriendRequest(db, requestId, userId) {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }
    
    const request = requestSnap.data();
    
    // Check if the user is the sender
    if (request.senderId !== userId) {
      throw new Error('You cannot cancel a request you did not send');
    }
    
    if (request.status !== 'pending') {
      throw new Error('This request has already been processed');
    }
    
    // Update the request status or delete it
    await updateDoc(requestRef, {
      status: 'canceled',
      updatedAt: serverTimestamp()
    });
    
    return requestId;
  }
  
  /**
   * Remove a friend
   * @param {Object} db - Firestore instance
   * @param {string} userId - User ID
   * @param {string} friendId - Friend ID to remove
   */
  export async function removeFriend(db, userId, friendId) {
    // Get user reference
    const userRef = doc(db, 'users', userId);
    const friendRef = doc(db, 'users', friendId);
    
    // Make sure the user exists
    const userSnap = await getDoc(userRef);
    const friendSnap = await getDoc(friendRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    if (!friendSnap.exists()) {
      throw new Error('Friend not found');
    }
    
    // Check if they are actually friends
    const userData = userSnap.data();
    
    if (!userData.friends || !userData.friends.includes(friendId)) {
      throw new Error('This user is not in your friends list');
    }
    
    // Remove from both user's friend lists
    await updateDoc(userRef, {
      friends: arrayRemove(friendId),
      updatedAt: serverTimestamp()
    });
    
    await updateDoc(friendRef, {
      friends: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });
    
    return {
      userId,
      friendId
    };
  }
  
  /**
   * Get all friend requests for a user
   * @param {Object} db - Firestore instance
   * @param {string} userId - User ID
   * @param {string} type - Type of requests: 'incoming', 'outgoing', or 'all'
   * @param {string} status - Status of requests: 'pending', 'accepted', 'rejected', or 'all'
   */
  export async function getFriendRequests(db, userId, type = 'all', status = 'pending') {
    const requestsRef = collection(db, 'friendRequests');
    let requestQuery;
    
    // Query based on type
    if (type === 'incoming') {
      requestQuery = query(requestsRef, where('recipientId', '==', userId));
    } else if (type === 'outgoing') {
      requestQuery = query(requestsRef, where('senderId', '==', userId));
    } else {
      // 'all' - get both incoming and outgoing
      const incomingQuery = query(requestsRef, where('recipientId', '==', userId));
      const outgoingQuery = query(requestsRef, where('senderId', '==', userId));
      
      const incomingSnapshot = await getDocs(incomingQuery);
      const outgoingSnapshot = await getDocs(outgoingQuery);
      
      const incomingRequests = incomingSnapshot.docs.map(doc => ({ 
        ...doc.data(), 
        direction: 'incoming' 
      }));
      
      const outgoingRequests = outgoingSnapshot.docs.map(doc => ({ 
        ...doc.data(), 
        direction: 'outgoing' 
      }));
      
      // Filter by status if needed
      const allRequests = [...incomingRequests, ...outgoingRequests];
      
      if (status !== 'all') {
        return allRequests.filter(request => request.status === status);
      }
      
      return allRequests;
    }
    
    // Add status filter if needed
    if (status !== 'all') {
      requestQuery = query(requestQuery, where('status', '==', status));
    }
    
    // Add order by creation date
    requestQuery = query(requestQuery, orderBy('createdAt', 'desc'));
    
    // Execute query
    const querySnapshot = await getDocs(requestQuery);
    
    // Format results
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        // Add a direction property to easily identify incoming vs outgoing
        direction: data.recipientId === userId ? 'incoming' : 'outgoing'
      };
    });
  }
  
  /**
   * Get all friends of a user with their profile information
   * @param {Object} db - Firestore instance
   * @param {string} userId - User ID
   */
  export async function getFriends(db, userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    
    if (!userData.friends || userData.friends.length === 0) {
      return [];
    }
    
    // Get the profile information for each friend
    const friendProfiles = await Promise.all(
      userData.friends.map(async (friendId) => {
        const friendRef = doc(db, 'users', friendId);
        const friendSnap = await getDoc(friendRef);
        
        if (friendSnap.exists()) {
          // Return only non-sensitive information
          const friendData = friendSnap.data();
          return {
            id: friendId,
            displayName: friendData.displayName || 'Unknown User',
            photoURL: friendData.photoURL || null,
            email: friendData.email || null, // Email should only be included if it's public
            // Don't include sensitive fields like savedAddresses, homeAddress, etc.
          };
        }
        
        // Friend document doesn't exist (rare case)
        return {
          id: friendId,
          displayName: 'Unknown User',
          photoURL: null,
          error: 'User profile not found'
        };
      })
    );
    
    return friendProfiles;
  }
  
  /**
   * Search for users to add as friends
   * @param {Object} db - Firestore instance
   * @param {string} searchTerm - Email or display name to search for
   * @param {string} currentUserId - Current user ID (to exclude from results)
   * @param {number} limit - Maximum number of results to return
   */
  export async function searchUsers(db, searchTerm, currentUserId, limit = 10) {
    if (!searchTerm || searchTerm.trim().length < 3) {
      return [];
    }
    
    // For simplicity, we'll implement a simple search by email
    // In a production app, you'd want to use Firestore's array-contains 
    // with searchable terms, or an external search service like Algolia
    
    // For now, we'll query by exact email match
    const usersRef = collection(db, 'users');
    const emailQuery = query(
      usersRef,
      where('email', '==', searchTerm.trim()),
      where('__name__', '!=', currentUserId)
    );
    
    const querySnapshot = await getDocs(emailQuery);
    
    // Format results, excluding sensitive information
    return querySnapshot.docs.map(doc => {
      const userData = doc.data();
      return {
        id: doc.id,
        displayName: userData.displayName || 'Unknown User',
        photoURL: userData.photoURL || null,
        email: userData.email || null
      };
    }).slice(0, limit);
  }