// backend/firebase/functions/src/friends.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud function triggered when a new friend request is created
 * Sends a notification to the recipient
 */
exports.onFriendRequestCreated = functions.firestore
  .document('friendRequests/{requestId}')
  .onCreate(async (snapshot, context) => {
    try {
      const requestData = snapshot.data();
      const { senderId, recipientId, senderName } = requestData;
      
      // Get recipient's FCM token for push notifications
      const recipientDoc = await db.collection('users').doc(recipientId).get();
      
      if (!recipientDoc.exists) {
        console.log(`Recipient ${recipientId} not found`);
        return null;
      }
      
      const recipientData = recipientDoc.data();
      const fcmToken = recipientData.fcmToken;
      
      // Create a notification in the database
      await db.collection('notifications').add({
        userId: recipientId,
        type: 'friendRequest',
        content: `${senderName} sent you a friend request`,
        requestId: context.params.requestId,
        senderId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // If we have a token, send a push notification
      if (fcmToken) {
        const message = {
          token: fcmToken,
          notification: {
            title: 'New Friend Request',
            body: `${senderName} sent you a friend request`
          },
          data: {
            type: 'friendRequest',
            requestId: context.params.requestId,
            senderId
          }
        };
        
        await admin.messaging().send(message);
        console.log(`Push notification sent to ${recipientId}`);
      }
      
      return null;
    } catch (error) {
      console.error('Error processing friend request:', error);
      return null;
    }
  });

/**
 * Cloud function triggered when a friend request is updated
 * Handles notifications and user data updates when a request is accepted or rejected
 */
exports.onFriendRequestUpdated = functions.firestore
  .document('friendRequests/{requestId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      
      // If status didn't change, do nothing
      if (beforeData.status === afterData.status) {
        return null;
      }
      
      const { senderId, recipientId, senderName, recipientName } = afterData;
      
      // Handle accepted requests
      if (afterData.status === 'accepted') {
        // Create notifications for both users
        await db.collection('notifications').add({
          userId: senderId,
          type: 'friendRequestAccepted',
          content: `${recipientName} accepted your friend request`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Get sender's FCM token for push notification
        const senderDoc = await db.collection('users').doc(senderId).get();
        if (senderDoc.exists) {
          const senderData = senderDoc.data();
          const fcmToken = senderData.fcmToken;
          
          if (fcmToken) {
            const message = {
              token: fcmToken,
              notification: {
                title: 'Friend Request Accepted',
                body: `${recipientName} accepted your friend request`
              },
              data: {
                type: 'friendRequestAccepted',
                userId: recipientId
              }
            };
            
            await admin.messaging().send(message);
          }
        }
      }
      
      // Handle rejected requests
      else if (afterData.status === 'rejected') {
        // Optionally create a notification for the sender
        // Most apps don't notify for rejections to avoid negative experiences
      }
      
      return null;
    } catch (error) {
      console.error('Error processing friend request update:', error);
      return null;
    }
  });

/**
 * Cloud function triggered when a user is deleted
 * Removes the user from all friends lists and deletes pending friend requests
 */
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    const userId = user.uid;
    
    // Get the user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`User document for ${userId} not found`);
      return null;
    }
    
    const userData = userDoc.data();
    
    // If the user has friends, remove them from their friends' lists
    if (userData.friends && userData.friends.length > 0) {
      // Create batch operations to update all friends
      const batch = db.batch();
      
      for (const friendId of userData.friends) {
        const friendRef = db.collection('users').doc(friendId);
        batch.update(friendRef, {
          friends: admin.firestore.FieldValue.arrayRemove(userId)
        });
      }
      
      await batch.commit();
    }
    
    // Delete pending friend requests
    const incomingRequestsQuery = await db.collection('friendRequests')
      .where('recipientId', '==', userId)
      .where('status', '==', 'pending')
      .get();
      
    const outgoingRequestsQuery = await db.collection('friendRequests')
      .where('senderId', '==', userId)
      .where('status', '==', 'pending')
      .get();
    
    // Create batch operations to delete all requests
    const batch = db.batch();
    
    incomingRequestsQuery.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    outgoingRequestsQuery.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    return null;
  } catch (error) {
    console.error('Error processing user deletion:', error);
    return null;
  }
});