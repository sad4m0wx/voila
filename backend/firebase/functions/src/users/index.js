const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// Create user profile when a new user signs up
exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
  try {
    const userRef = db.collection('users').doc(user.uid);
    
    // Check if the profile already exists
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      functions.logger.info(`User profile already exists for ${user.uid}`);
      return { success: true };
    }
    
    // Create the user document
    await userRef.set({
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      homeAddress: null,
      savedAddresses: [],
      friends: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isAnonymous: user.providerData.length === 0 // Check if the user is anonymous
    });
    
    functions.logger.info(`Created profile for user ${user.uid}`);
    return { success: true };
  } catch (error) {
    functions.logger.error(`Error creating user profile: ${error.message}`, { userId: user.uid });
    throw new functions.https.HttpsError('internal', `Failed to create user profile: ${error.message}`);
  }
});

// Callable function to search for users by email (for adding friends)
exports.findUserByEmail = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  // Get the email to search for
  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }
  
  try {
    // Search for the user
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return { found: false, message: 'User not found' };
    }
    
    // Get the first matching user
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Return limited public info
    return {
      found: true,
      user: {
        id: userDoc.id,
        displayName: userData.displayName,
        photoURL: userData.photoURL
      }
    };
  } catch (error) {
    functions.logger.error(`Error finding user by email: ${error.message}`, { email });
    throw new functions.https.HttpsError('internal', `Failed to find user: ${error.message}`);
  }
});

// Send friend request
exports.sendFriendRequest = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { recipientId } = data;
  if (!recipientId) {
    throw new functions.https.HttpsError('invalid-argument', 'Recipient ID is required');
  }
  
  const senderId = context.auth.uid;
  
  try {
    // Prevent self-friending
    if (senderId === recipientId) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot send friend request to yourself');
    }
    
    // Check if recipient exists
    const recipientRef = db.collection('users').doc(recipientId);
    const recipientDoc = await recipientRef.get();
    
    if (!recipientDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Recipient not found');
    }
    
    // Check if they're already friends
    const senderRef = db.collection('users').doc(senderId);
    const senderDoc = await senderRef.get();
    const senderData = senderDoc.data();
    
    if (senderData.friends && senderData.friends.includes(recipientId)) {
      throw new functions.https.HttpsError('already-exists', 'You are already friends with this user');
    }
    
    // Check if a request already exists
    const requestsSnapshot = await db.collection('friendRequests')
      .where('senderId', '==', senderId)
      .where('recipientId', '==', recipientId)
      .where('status', '==', 'pending')
      .get();
    
    if (!requestsSnapshot.empty) {
      throw new functions.https.HttpsError('already-exists', 'A friend request has already been sent');
    }
    
    // Create the friend request
    const requestRef = await db.collection('friendRequests').add({
      senderId,
      recipientId,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { 
      success: true, 
      requestId: requestRef.id 
    };
  } catch (error) {
    functions.logger.error(`Error sending friend request: ${error.message}`, { senderId, recipientId });
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', `Failed to send friend request: ${error.message}`);
  }
});

// Accept friend request
exports.acceptFriendRequest = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { requestId } = data;
  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'Request ID is required');
  }
  
  const userId = context.auth.uid;
  
  try {
    // Get the friend request
    const requestRef = db.collection('friendRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Friend request not found');
    }
    
    const request = requestDoc.data();
    
    // Ensure the current user is the recipient
    if (request.recipientId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot accept a request not sent to you');
    }
    
    // Ensure the request is pending
    if (request.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'This request has already been processed');
    }
    
    // Update request status
    await requestRef.update({
      status: 'accepted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Add each user to the other's friends list
    const senderRef = db.collection('users').doc(request.senderId);
    const recipientRef = db.collection('users').doc(request.recipientId);
    
    // Batch write to ensure atomicity
    const batch = db.batch();
    
    batch.update(senderRef, {
      friends: admin.firestore.FieldValue.arrayUnion(request.recipientId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    batch.update(recipientRef, {
      friends: admin.firestore.FieldValue.arrayUnion(request.senderId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    functions.logger.error(`Error accepting friend request: ${error.message}`, { userId, requestId });
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', `Failed to accept friend request: ${error.message}`);
  }
});

// Create a group
exports.createGroup = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { name, description, members } = data;
  if (!name) {
    throw new functions.https.HttpsError('invalid-argument', 'Group name is required');
  }
  
  const creatorId = context.auth.uid;
  
  try {
    // Ensure creator is included in members
    const groupMembers = Array.isArray(members) ? [...members] : [];
    if (!groupMembers.includes(creatorId)) {
      groupMembers.push(creatorId);
    }
    
    // Create the group
    const groupRef = await db.collection('groups').add({
      name,
      description: description || '',
      creatorId,
      members: groupMembers,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      groupId: groupRef.id
    };
  } catch (error) {
    functions.logger.error(`Error creating group: ${error.message}`, { creatorId, name });
    throw new functions.https.HttpsError('internal', `Failed to create group: ${error.message}`);
  }
});

// Get friends with profiles
exports.getFriendsWithProfiles = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const userId = context.auth.uid;
  
  try {
    // Get user document to access friends list
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    const friendIds = userData.friends || [];
    
    // If no friends, return empty array
    if (friendIds.length === 0) {
      return { friends: [] };
    }
    
    // Get all friend profiles
    const friendProfiles = await Promise.all(
      friendIds.map(async (friendId) => {
        const friendRef = db.collection('users').doc(friendId);
        const friendDoc = await friendRef.get();
        
        if (!friendDoc.exists) {
          return null;
        }
        
        const friendData = friendDoc.data();
        
        // Return limited profile data
        return {
          id: friendId,
          displayName: friendData.displayName,
          photoURL: friendData.photoURL,
          email: friendData.email
        };
      })
    );
    
    // Filter out any null entries (for deleted users)
    const validFriends = friendProfiles.filter(friend => friend !== null);
    
    return { friends: validFriends };
  } catch (error) {
    functions.logger.error(`Error getting friends: ${error.message}`, { userId });
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', `Failed to get friends: ${error.message}`);
  }
});