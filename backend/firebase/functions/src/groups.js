// backend/firebase/functions/src/groups.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud function triggered when a new group is created
 * Sets up initial memberships and notifies members
 */
exports.onGroupCreated = functions.firestore
  .document('groups/{groupId}')
  .onCreate(async (snapshot, context) => {
    try {
      const groupData = snapshot.data();
      const { creatorId, name, members } = groupData;
      const groupId = context.params.groupId;
      
      console.log(`New group "${name}" created by ${creatorId} with ${members.length} members`);
      
      // Create notification for the creator (confirmation)
      await db.collection('notifications').add({
        userId: creatorId,
        type: 'groupCreated',
        content: `You created the group "${name}"`,
        groupId,
        groupName: name,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Notify other members they were added to group
      for (const memberId of members) {
        // Skip the creator (already notified)
        if (memberId === creatorId) continue;
        
        // Get member details
        const memberDoc = await db.collection('users').doc(memberId).get();
        
        if (memberDoc.exists) {
          // Create notification
          await db.collection('notifications').add({
            userId: memberId,
            type: 'groupAddedMember',
            content: `You were added to the group "${name}"`,
            groupId,
            groupName: name,
            addedBy: creatorId,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Send push notification if FCM token available
          const fcmToken = memberDoc.data().fcmToken;
          if (fcmToken) {
            const message = {
              token: fcmToken,
              notification: {
                title: 'Added to New Group',
                body: `You were added to the group "${name}"`
              },
              data: {
                type: 'groupAddedMember',
                groupId,
                groupName: name
              }
            };
            
            await admin.messaging().send(message);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error processing group creation:', error);
      return null;
    }
  });

/**
 * Cloud function triggered when a new group invite is created
 * Sends a notification to the invited user
 */
exports.onGroupInviteCreated = functions.firestore
  .document('groupInvites/{inviteId}')
  .onCreate(async (snapshot, context) => {
    try {
      const inviteData = snapshot.data();
      const { groupId, groupName, userId, invitedBy, inviterName, message } = inviteData;
      
      // Get the invited user
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        console.log(`User ${userId} not found for invite`);
        return null;
      }
      
      // Create a notification in the database
      await db.collection('notifications').add({
        userId: userId,
        type: 'groupInvite',
        content: `${inviterName} invited you to join the group "${groupName}"`,
        groupId,
        groupName,
        inviteId: context.params.inviteId,
        invitedBy,
        message: message || '',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Send push notification if FCM token available
      const fcmToken = userDoc.data().fcmToken;
      if (fcmToken) {
        const message = {
          token: fcmToken,
          notification: {
            title: 'New Group Invite',
            body: `${inviterName} invited you to join "${groupName}"`
          },
          data: {
            type: 'groupInvite',
            inviteId: context.params.inviteId,
            groupId,
            groupName
          }
        };
        
        await admin.messaging().send(message);
      }
      
      return null;
    } catch (error) {
      console.error('Error processing group invite:', error);
      return null;
    }
  });

/**
 * Cloud function triggered when a group invite is updated
 * Handles notifications for accepted/declined invites
 */
exports.onGroupInviteUpdated = functions.firestore
  .document('groupInvites/{inviteId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      
      // Only process if status changed
      if (beforeData.status === afterData.status) {
        return null;
      }
      
      const { groupId, groupName, userId, invitedBy, status } = afterData;
      
      // Get inviter and invitee for notifications
      const inviterDoc = await db.collection('users').doc(invitedBy).get();
      const inviteeDoc = await db.collection('users').doc(userId).get();
      
      const inviterName = inviterDoc.exists ? inviterDoc.data().displayName || 'A user' : 'A user';
      const inviteeName = inviteeDoc.exists ? inviteeDoc.data().displayName || 'A user' : 'A user';
      
      // Handle accepted invites
      if (status === 'accepted') {
        // Notify the inviter
        await db.collection('notifications').add({
          userId: invitedBy,
          type: 'groupInviteAccepted',
          content: `${inviteeName} accepted your invitation to join "${groupName}"`,
          groupId,
          groupName,
          inviteId: context.params.inviteId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify group admins (except the inviter)
        const groupDoc = await db.collection('groups').doc(groupId).get();
        
        if (groupDoc.exists) {
          const { admins } = groupDoc.data();
          
          for (const adminId of admins) {
            // Skip the inviter (already notified)
            if (adminId === invitedBy) continue;
            
            await db.collection('notifications').add({
              userId: adminId,
              type: 'groupNewMember',
              content: `${inviteeName} joined the group "${groupName}"`,
              groupId,
              groupName,
              memberId: userId,
              memberName: inviteeName,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
      
      // Handle declined invites
      else if (status === 'declined') {
        // Only notify the inviter
        await db.collection('notifications').add({
          userId: invitedBy,
          type: 'groupInviteDeclined',
          content: `${inviteeName} declined your invitation to join "${groupName}"`,
          groupId,
          groupName,
          inviteId: context.params.inviteId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return null;
    } catch (error) {
      console.error('Error processing group invite update:', error);
      return null;
    }
  });

/**
 * Cloud function triggered when a group member is added (via update to members array)
 * Notifies all group members about the new addition
 */
exports.onGroupMemberAdded = functions.firestore
  .document('groups/{groupId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      
      // Check if members array changed
      if (JSON.stringify(beforeData.members) === JSON.stringify(afterData.members)) {
        return null;
      }
      
      const groupId = context.params.groupId;
      const { name: groupName, members: newMembers } = afterData;
      const oldMembers = beforeData.members || [];
      
      // Find newly added members
      const addedMembers = newMembers.filter(member => !oldMembers.includes(member));
      
      if (addedMembers.length === 0) {
        // No new members, must be a removal
        return null;
      }
      
      // Find who added the member by checking recent membership records
      for (const newMemberId of addedMembers) {
        // Get membership record
        const membershipQuery = await db.collection('groupMemberships')
          .where('groupId', '==', groupId)
          .where('userId', '==', newMemberId)
          .orderBy('joinedAt', 'desc')
          .limit(1)
          .get();
          
        if (membershipQuery.empty) {
          console.log(`No membership record found for new member ${newMemberId} in group ${groupId}`);
          continue;
        }
        
        const membership = membershipQuery.docs[0].data();
        const addedBy = membership.addedBy;
        
        // Skip if we don't know who added them
        if (!addedBy) continue;
        
        // Get member names
        const memberDoc = await db.collection('users').doc(newMemberId).get();
        const adderDoc = await db.collection('users').doc(addedBy).get();
        
        const memberName = memberDoc.exists ? memberDoc.data().displayName || 'A user' : 'A user';
        const adderName = adderDoc.exists ? adderDoc.data().displayName || 'A user' : 'A user';
        
        // Notify all existing members (except the person who was added and who added them)
        for (const memberId of oldMembers) {
          // Skip the new member and the person who added them
          if (memberId === newMemberId || memberId === addedBy) continue;
          
          await db.collection('notifications').add({
            userId: memberId,
            type: 'groupNewMember',
            content: `${adderName} added ${memberName} to "${groupName}"`,
            groupId,
            groupName,
            memberId: newMemberId,
            memberName,
            addedBy,
            adderName,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error processing group member addition:', error);
      return null;
    }
  });

/**
 * Cloud function to clean up old group invites
 * Runs on a schedule to mark old pending invites as expired
 */
exports.cleanupExpiredInvites = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    try {
      // Calculate date threshold (30 days ago)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Find old pending invites
      const oldInvitesQuery = await db.collection('groupInvites')
        .where('status', '==', 'pending')
        .where('createdAt', '<', thirtyDaysAgo)
        .get();
      
      if (oldInvitesQuery.empty) {
        console.log('No expired invites to clean up');
        return null;
      }
      
      console.log(`Found ${oldInvitesQuery.size} expired invites to clean up`);
      
      // Update invites in batches to avoid write limits
      const batch = db.batch();
      let batchCount = 0;
      
      oldInvitesQuery.forEach(doc => {
        batch.update(doc.ref, {
          status: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        batchCount++;
        
        // Commit batch every 500 updates
        if (batchCount >= 500) {
          batch.commit();
          batchCount = 0;
        }
      });
      
      // Commit any remaining updates
      if (batchCount > 0) {
        await batch.commit();
      }
      
      return null;
    } catch (error) {
      console.error('Error cleaning up expired invites:', error);
      return null;
    }
  });

/**
 * Cloud function to handle user account deletion
 * Remove the user from all groups and cancel their invites
 */
exports.cleanupUserGroups = functions.auth.user()
  .onDelete(async (user) => {
    try {
      const userId = user.uid;
      
      // Get all groups the user is a member of
      const membershipQuery = await db.collection('groupMemberships')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .get();
      
      // Process each group membership
      for (const doc of membershipQuery.docs) {
        const { groupId, role } = doc.data();
        
        // Get the group
        const groupRef = db.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();
        
        if (!groupSnap.exists) continue;
        
        const groupData = groupSnap.data();
        
        // If user is the creator, handle specially
        if (groupData.creatorId === userId) {
          // Option 1: Delete the group
          // await groupRef.delete();
          
          // Option 2: Transfer ownership to another admin
          const otherAdmins = groupData.admins.filter(adminId => adminId !== userId);
          
          if (otherAdmins.length > 0) {
            // Transfer to first available admin
            const newCreatorId = otherAdmins[0];
            await groupRef.update({
              creatorId: newCreatorId,
              members: admin.firestore.FieldValue.arrayRemove(userId),
              admins: admin.firestore.FieldValue.arrayRemove(userId),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Notify the new creator
            await db.collection('notifications').add({
              userId: newCreatorId,
              type: 'groupOwnershipTransferred',
              content: `You are now the owner of the group "${groupData.name}"`,
              groupId,
              groupName: groupData.name,
              previousOwnerId: userId,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } else {
            // No other admins, delete the group
            await groupRef.delete();
          }
        } else {
          // Regular member or admin, just remove from the group
          await groupRef.update({
            members: admin.firestore.FieldValue.arrayRemove(userId),
            admins: admin.firestore.FieldValue.arrayRemove(userId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        // Update membership record
        await doc.ref.update({
          active: false,
          removedAt: admin.firestore.FieldValue.serverTimestamp(),
          removedReason: 'account_deleted'
        });
      }
      
      // Cancel all pending invites sent by this user
      const sentInvitesQuery = await db.collection('groupInvites')
        .where('invitedBy', '==', userId)
        .where('status', '==', 'pending')
        .get();
      
      for (const doc of sentInvitesQuery.docs) {
        await doc.ref.update({
          status: 'canceled',
          canceledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelReason: 'inviter_account_deleted',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Cancel all pending invites sent to this user
      const receivedInvitesQuery = await db.collection('groupInvites')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .get();
      
      for (const doc of receivedInvitesQuery.docs) {
        await doc.ref.update({
          status: 'canceled',
          canceledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelReason: 'invitee_account_deleted',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return null;
    } catch (error) {
      console.error('Error cleaning up user groups:', error);
      return null;
    }
  });