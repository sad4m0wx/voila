// packages/firebase-auth/groups.js
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
    orderBy,
    limit,
    Timestamp,
    onSnapshot
  } from 'firebase/firestore';
  import { getFriends } from './friends';
  
  /**
   * Create a new group
   * @param {Object} db - Firestore instance
   * @param {string} creatorId - User ID of the creator
   * @param {Object} groupData - Group data including name and description
   * @param {Array} initialMembers - Array of user IDs to add as initial members (optional)
   * @returns {Object} - The new group data
   */
  export async function createGroup(db, creatorId, groupData, initialMembers = []) {
    // Create a reference for the new group
    const groupRef = doc(collection(db, 'groups'));
    
    // Ensure the creator is included in members
    const memberIds = Array.from(new Set([creatorId, ...initialMembers]));
    
    // Create initial group data
    const newGroup = {
      id: groupRef.id,
      name: groupData.name,
      description: groupData.description || '',
      creatorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      members: memberIds,
      admins: [creatorId], // Creator is automatically an admin
      invites: [] // No invites initially
    };
    
    // Save the group
    await setDoc(groupRef, newGroup);
    
    // Create group membership records for each member
    for (const memberId of memberIds) {
      const membershipRef = doc(collection(db, 'groupMemberships'));
      await setDoc(membershipRef, {
        id: membershipRef.id,
        userId: memberId,
        groupId: groupRef.id,
        role: memberId === creatorId ? 'admin' : 'member',
        joinedAt: serverTimestamp()
      });
    }
    
    return {
      ...newGroup,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  /**
   * Get a group by ID
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @returns {Object} - Group data
   */
  export async function getGroup(db, groupId) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      throw new Error('Group not found');
    }
    
    return {
      ...groupSnap.data(),
      // Convert Firestore timestamps to JS dates
      createdAt: groupSnap.data().createdAt ? groupSnap.data().createdAt.toDate() : null,
      updatedAt: groupSnap.data().updatedAt ? groupSnap.data().updatedAt.toDate() : null
    };
  }
  
  /**
   * Get all groups for a user
   * @param {Object} db - Firestore instance
   * @param {string} userId - User ID
   * @returns {Array} - Array of group data
   */
  export async function getUserGroups(db, userId) {
    // Query memberships to find all groups the user is a member of
    const membershipQuery = query(
      collection(db, 'groupMemberships'),
      where('userId', '==', userId)
    );
    
    const memberships = await getDocs(membershipQuery);
    
    if (memberships.empty) {
      return [];
    }
    
    // Get all group IDs from memberships
    const groupIds = memberships.docs.map(doc => doc.data().groupId);
    
    // Get all groups by IDs
    const groups = await Promise.all(
      groupIds.map(async (groupId) => {
        try {
          return await getGroup(db, groupId);
        } catch (error) {
          console.error(`Error fetching group ${groupId}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null results (errors)
    return groups.filter(group => group !== null);
  }
  
  /**
   * Get all members of a group with their profiles
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} currentUserId - Current user ID for determining friends
   * @returns {Array} - Array of member profiles
   */
  export async function getGroupMembers(db, groupId, currentUserId) {
    const group = await getGroup(db, groupId);
    
    if (!group.members || group.members.length === 0) {
      return [];
    }
    
    // Get the current user's friends to determine visibility
    const userFriends = await getFriends(db, currentUserId);
    const friendIds = userFriends.map(friend => friend.id);
    
    // Get memberships to get roles
    const membershipQuery = query(
      collection(db, 'groupMemberships'),
      where('groupId', '==', groupId)
    );
    
    const memberships = await getDocs(membershipQuery);
    const membershipMap = new Map();
    
    memberships.forEach(doc => {
      const data = doc.data();
      membershipMap.set(data.userId, {
        role: data.role,
        joinedAt: data.joinedAt ? data.joinedAt.toDate() : null
      });
    });
    
    // Get the profile information for each member
    const memberProfiles = await Promise.all(
      group.members.map(async (memberId) => {
        const memberRef = doc(db, 'users', memberId);
        const memberSnap = await getDoc(memberRef);
        
        if (memberSnap.exists()) {
          const userData = memberSnap.data();
          const isFriend = friendIds.includes(memberId) || memberId === currentUserId;
          const membership = membershipMap.get(memberId) || { role: 'member' };
          
          // Return member info with privacy considerations
          return {
            id: memberId,
            displayName: userData.displayName || 'Unknown User',
            photoURL: userData.photoURL || null,
            email: userData.email || null,
            role: membership.role,
            isAdmin: membership.role === 'admin',
            isCreator: group.creatorId === memberId,
            joinedAt: membership.joinedAt,
            // Only include address info if they're friends or self
            homeAddress: isFriend ? userData.homeAddress : null,
            // Flag to indicate if they're friends (for UI)
            isFriend: isFriend,
            savedAddresses: isFriend ? userData.savedAddresses : null
          };
        }
        
        // Member document doesn't exist (rare case)
        return {
          id: memberId,
          displayName: 'Unknown User',
          role: membershipMap.get(memberId)?.role || 'member',
          isAdmin: membershipMap.get(memberId)?.role === 'admin',
          isCreator: group.creatorId === memberId,
          isFriend: false,
          error: 'User profile not found'
        };
      })
    );
    
    return memberProfiles;
  }
  
  /**
   * Update a group's basic information
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {Object} updateData - Data to update (name, description)
   * @param {string} userId - User ID making the update (must be admin)
   * @returns {Object} - Updated group
   */
  export async function updateGroup(db, groupId, updateData, userId) {
    // Check if user is admin
    const group = await getGroup(db, groupId);
    
    if (!group.admins.includes(userId)) {
      throw new Error('Only group admins can update group information');
    }
    
    // Only allow updating certain fields
    const allowedFields = ['name', 'description'];
    const filteredUpdate = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});
    
    // Add timestamp
    filteredUpdate.updatedAt = serverTimestamp();
    
    // Update the group
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, filteredUpdate);
    
    // Get the updated group
    return getGroup(db, groupId);
  }
  
  /**
   * Add a user to a group
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to add
   * @param {string} addedBy - User ID adding the member (must be member)
   * @returns {Object} - Updated group
   */
  export async function addGroupMember(db, groupId, userId, addedBy) {
    // Check if the user adding is a member
    const group = await getGroup(db, groupId);
    
    if (!group.members.includes(addedBy)) {
      throw new Error('Only group members can add new members');
    }
    
    // Check if user is already a member
    if (group.members.includes(userId)) {
      throw new Error('User is already a member of this group');
    }
    
    // Add to members array
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      members: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });
    
    // Create membership record
    const membershipRef = doc(collection(db, 'groupMemberships'));
    await setDoc(membershipRef, {
      id: membershipRef.id,
      userId: userId,
      groupId: groupId,
      role: 'member',
      addedBy: addedBy,
      joinedAt: serverTimestamp()
    });
    
    // If there was a pending invite, mark it as accepted
    const inviteQuery = query(
      collection(db, 'groupInvites'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const invites = await getDocs(inviteQuery);
    
    invites.forEach(async (invite) => {
      const inviteRef = doc(db, 'groupInvites', invite.id);
      await updateDoc(inviteRef, {
        status: 'accepted',
        respondedAt: serverTimestamp()
      });
    });
    
    // Get the updated group
    return getGroup(db, groupId);
  }
  
  /**
   * Remove a user from a group
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to remove
   * @param {string} removedBy - User ID removing the member (must be admin or self)
   * @returns {Object} - Updated group
   */
  export async function removeGroupMember(db, groupId, userId, removedBy) {
    // Check if the removing user has permission
    const group = await getGroup(db, groupId);
    
    // Allow self-removal or admin removal
    const isSelfRemoval = userId === removedBy;
    const isAdminRemoval = group.admins.includes(removedBy);
    
    if (!isSelfRemoval && !isAdminRemoval) {
      throw new Error('Only admins can remove other members');
    }
    
    // Prevent removing the creator
    if (userId === group.creatorId) {
      throw new Error('Cannot remove the group creator');
    }
    
    // Remove from members array
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      members: arrayRemove(userId),
      admins: arrayRemove(userId), // Also remove from admins if they were admin
      updatedAt: serverTimestamp()
    });
    
    // Find and update membership record
    const membershipQuery = query(
      collection(db, 'groupMemberships'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    
    const memberships = await getDocs(membershipQuery);
    
    memberships.forEach(async (membership) => {
      const membershipRef = doc(db, 'groupMemberships', membership.id);
      // We could delete, but better to keep a record and mark as removed
      await updateDoc(membershipRef, {
        active: false, 
        removedAt: serverTimestamp(),
        removedBy: removedBy
      });
    });
    
    // Get the updated group
    return getGroup(db, groupId);
  }
  
  /**
   * Promote a user to admin in a group
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to promote
   * @param {string} promotedBy - User ID promoting (must be admin)
   * @returns {Object} - Updated group
   */
  export async function promoteToAdmin(db, groupId, userId, promotedBy) {
    // Check if the promoting user is an admin
    const group = await getGroup(db, groupId);
    
    if (!group.admins.includes(promotedBy)) {
      throw new Error('Only admins can promote members');
    }
    
    // Check if user is a member
    if (!group.members.includes(userId)) {
      throw new Error('User is not a member of this group');
    }
    
    // Check if already admin
    if (group.admins.includes(userId)) {
      throw new Error('User is already an admin');
    }
    
    // Add to admins array
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      admins: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });
    
    // Update membership role
    const membershipQuery = query(
      collection(db, 'groupMemberships'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    
    const memberships = await getDocs(membershipQuery);
    
    memberships.forEach(async (membership) => {
      const membershipRef = doc(db, 'groupMemberships', membership.id);
      await updateDoc(membershipRef, {
        role: 'admin',
        promotedAt: serverTimestamp(),
        promotedBy: promotedBy
      });
    });
    
    // Get the updated group
    return getGroup(db, groupId);
  }
  
  /**
   * Demote an admin to regular member
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to demote
   * @param {string} demotedBy - User ID demoting (must be admin)
   * @returns {Object} - Updated group
   */
  export async function demoteFromAdmin(db, groupId, userId, demotedBy) {
    // Check if the demoting user is an admin
    const group = await getGroup(db, groupId);
    
    if (!group.admins.includes(demotedBy)) {
      throw new Error('Only admins can demote other admins');
    }
    
    // Cannot demote the creator
    if (userId === group.creatorId) {
      throw new Error('Cannot demote the group creator');
    }
    
    // Check if user is an admin
    if (!group.admins.includes(userId)) {
      throw new Error('User is not an admin');
    }
    
    // Remove from admins array
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      admins: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });
    
    // Update membership role
    const membershipQuery = query(
      collection(db, 'groupMemberships'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    
    const memberships = await getDocs(membershipQuery);
    
    memberships.forEach(async (membership) => {
      const membershipRef = doc(db, 'groupMemberships', membership.id);
      await updateDoc(membershipRef, {
        role: 'member',
        demotedAt: serverTimestamp(),
        demotedBy: demotedBy
      });
    });
    
    // Get the updated group
    return getGroup(db, groupId);
  }
  
  /**
   * Delete a group
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID deleting (must be creator)
   * @returns {boolean} - Success
   */
  export async function deleteGroup(db, groupId, userId) {
    // Check if the user is the creator
    const group = await getGroup(db, groupId);
    
    if (group.creatorId !== userId) {
      throw new Error('Only the group creator can delete the group');
    }
    
    // Delete the group
    const groupRef = doc(db, 'groups', groupId);
    await deleteDoc(groupRef);
    
    // Mark all memberships as inactive
    const membershipQuery = query(
      collection(db, 'groupMemberships'),
      where('groupId', '==', groupId)
    );
    
    const memberships = await getDocs(membershipQuery);
    
    memberships.forEach(async (membership) => {
      const membershipRef = doc(db, 'groupMemberships', membership.id);
      await updateDoc(membershipRef, {
        active: false,
        groupDeleted: true,
        deletedAt: serverTimestamp()
      });
    });
    
    // Cancel any pending invites
    const inviteQuery = query(
      collection(db, 'groupInvites'),
      where('groupId', '==', groupId),
      where('status', '==', 'pending')
    );
    
    const invites = await getDocs(inviteQuery);
    
    invites.forEach(async (invite) => {
      const inviteRef = doc(db, 'groupInvites', invite.id);
      await updateDoc(inviteRef, {
        status: 'canceled',
        groupDeleted: true,
        updatedAt: serverTimestamp()
      });
    });
    
    return true;
  }
  
  /**
   * Invite a user to a group
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userEmail - Email of user to invite
   * @param {string} invitedBy - User ID inviting (must be member)
   * @param {string} message - Optional message
   * @returns {Object} - Invite data
   */
  export async function inviteUserToGroup(db, groupId, userEmail, invitedBy, message = '') {
    // Check if the inviting user is a member
    const group = await getGroup(db, groupId);
    
    if (!group.members.includes(invitedBy)) {
      throw new Error('Only group members can invite others');
    }
    
    // Find user by email
    const userQuery = query(
      collection(db, 'users'),
      where('email', '==', userEmail),
      limit(1)
    );
    
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error('No user found with this email address');
    }
    
    const user = userSnapshot.docs[0];
    const userId = user.id;
    
    // Check if user is already a member
    if (group.members.includes(userId)) {
      throw new Error('User is already a member of this group');
    }
    
    // Check for existing pending invites
    const existingInviteQuery = query(
      collection(db, 'groupInvites'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const existingInvites = await getDocs(existingInviteQuery);
    
    if (!existingInvites.empty) {
      throw new Error('User already has a pending invite to this group');
    }
    
    // Create the invite
    const inviteRef = doc(collection(db, 'groupInvites'));
    
    // Get inviter's name
    const inviterRef = doc(db, 'users', invitedBy);
    const inviterSnap = await getDoc(inviterRef);
    const inviterName = inviterSnap.exists() ? inviterSnap.data().displayName || 'A user' : 'A user';
    
    const inviteData = {
      id: inviteRef.id,
      groupId,
      groupName: group.name,
      userId,
      userEmail,
      invitedBy,
      inviterName,
      message,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(inviteRef, inviteData);
    
    // Add to group's invites array
    await updateDoc(doc(db, 'groups', groupId), {
      invites: arrayUnion(inviteRef.id),
      updatedAt: serverTimestamp()
    });
    
    return {
      ...inviteData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  /**
   * Get all pending invites for a user
   * @param {Object} db - Firestore instance
   * @param {string} userId - User ID
   * @returns {Array} - Array of invite data
   */
  export async function getUserInvites(db, userId) {
    const inviteQuery = query(
      collection(db, 'groupInvites'),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const invites = await getDocs(inviteQuery);
    
    return invites.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
      };
    });
  }
  
  /**
   * Accept a group invite
   * @param {Object} db - Firestore instance
   * @param {string} inviteId - Invite ID
   * @param {string} userId - User ID accepting (must be invitee)
   * @returns {Object} - Group data
   */
  export async function acceptGroupInvite(db, inviteId, userId) {
    // Get the invite
    const inviteRef = doc(db, 'groupInvites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    
    if (!inviteSnap.exists()) {
      throw new Error('Invite not found');
    }
    
    const invite = inviteSnap.data();
    
    // Check if user is the invitee
    if (invite.userId !== userId) {
      throw new Error('You cannot accept an invite that was not sent to you');
    }
    
    // Check if invite is still pending
    if (invite.status !== 'pending') {
      throw new Error('This invite has already been processed');
    }
    
    // Update invite status
    await updateDoc(inviteRef, {
      status: 'accepted',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add user to group
    try {
      await addGroupMember(db, invite.groupId, userId, invite.invitedBy);
    } catch (error) {
      // If there's an error adding to group, revert invite status
      await updateDoc(inviteRef, {
        status: 'pending',
        updatedAt: serverTimestamp()
      });
      throw error;
    }
    
    // Get the group
    return getGroup(db, invite.groupId);
  }
  
  /**
   * Decline a group invite
   * @param {Object} db - Firestore instance
   * @param {string} inviteId - Invite ID
   * @param {string} userId - User ID declining (must be invitee)
   * @returns {boolean} - Success
   */
  export async function declineGroupInvite(db, inviteId, userId) {
    // Get the invite
    const inviteRef = doc(db, 'groupInvites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    
    if (!inviteSnap.exists()) {
      throw new Error('Invite not found');
    }
    
    const invite = inviteSnap.data();
    
    // Check if user is the invitee
    if (invite.userId !== userId) {
      throw new Error('You cannot decline an invite that was not sent to you');
    }
    
    // Check if invite is still pending
    if (invite.status !== 'pending') {
      throw new Error('This invite has already been processed');
    }
    
    // Update invite status
    await updateDoc(inviteRef, {
      status: 'declined',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Remove from group's invites array
    const groupRef = doc(db, 'groups', invite.groupId);
    await updateDoc(groupRef, {
      invites: arrayRemove(inviteId),
      updatedAt: serverTimestamp()
    });
    
    return true;
  }
  
  /**
   * Cancel a group invite
   * @param {Object} db - Firestore instance
   * @param {string} inviteId - Invite ID
   * @param {string} userId - User ID canceling (must be inviter or admin)
   * @returns {boolean} - Success
   */
  export async function cancelGroupInvite(db, inviteId, userId) {
    // Get the invite
    const inviteRef = doc(db, 'groupInvites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    
    if (!inviteSnap.exists()) {
      throw new Error('Invite not found');
    }
    
    const invite = inviteSnap.data();
    
    // Get the group
    const groupRef = doc(db, 'groups', invite.groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      throw new Error('Group not found');
    }
    
    const group = groupSnap.data();
    
    // Check if user has permission (inviter or admin)
    const isInviter = invite.invitedBy === userId;
    const isAdmin = group.admins.includes(userId);
    
    if (!isInviter && !isAdmin) {
      throw new Error('Only the inviter or group admins can cancel an invite');
    }
    
    // Check if invite is still pending
    if (invite.status !== 'pending') {
      throw new Error('This invite has already been processed');
    }
    
    // Update invite status
    await updateDoc(inviteRef, {
      status: 'canceled',
      canceledBy: userId,
      canceledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Remove from group's invites array
    await updateDoc(groupRef, {
      invites: arrayRemove(inviteId),
      updatedAt: serverTimestamp()
    });
    
    return true;
  }
  
  /**
   * Leave a group
   * @param {Object} db - Firestore instance
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID leaving
   * @returns {boolean} - Success
   */
  export async function leaveGroup(db, groupId, userId) {
    // Special case for the creator - they can't leave
    const group = await getGroup(db, groupId);
    
    if (group.creatorId === userId) {
      throw new Error('The group creator cannot leave. Transfer ownership or delete the group instead.');
    }
    
    // Check if user is a member
    if (!group.members.includes(userId)) {
      throw new Error('You are not a member of this group');
    }
    
    // Remove from group
    return removeGroupMember(db, groupId, userId, userId);
  }


  /**
 * Save meeting point for a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Object} meetingPointData - Meeting point data
 * @param {string} userId - User ID (must be member)
 */
export async function saveMeetingPoint(db, groupId, meetingPointData, userId) {
  // Check if user is a member
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(userId)) {
    throw new Error('Only group members can save meeting points');
  }
  
  // Update the group with meeting point
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    meetingPoint: {
      ...meetingPointData,
      calculatedAt: serverTimestamp(),
      calculatedBy: userId
    },
    updatedAt: serverTimestamp()
  });
  
  return meetingPointData;
}

/**
 * Toggle attendance for a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @param {string} status - 'coming' or 'not_coming'
 */
export async function toggleAttendance(db, groupId, userId, status) {
  // Check if user is a member
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(userId)) {
    throw new Error('Only group members can update attendance');
  }
  
  // Update attendance
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    [`attendance.${userId}`]: {
      status: status,
      updatedAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  });
  
  return status;
}


/**
 * Update member attendance status for a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @param {boolean} isAttending - Whether user is attending
 * @param {Object} location - User's current location (optional)
 * @returns {Object} - Updated attendance data
 */
export async function updateAttendanceStatus(db, groupId, userId, isAttending, location = null) {
  // Verify user is a member of the group
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(userId)) {
    throw new Error('You must be a member of this group');
  }
  
  // Create or update attendance record
  const attendanceRef = doc(db, 'groupAttendance', `${groupId}_${userId}`);
  
  const attendanceData = {
    groupId,
    userId,
    isAttending,
    updatedAt: serverTimestamp(),
    location: location || null
  };
  
  await setDoc(attendanceRef, attendanceData, { merge: true });
  
  return {
    ...attendanceData,
    updatedAt: new Date()
  };
}

/**
 * Get attendance status for all group members
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @returns {Array} - Array of attendance records
 */
export async function getGroupAttendance(db, groupId) {
  const attendanceQuery = query(
    collection(db, 'groupAttendance'),
    where('groupId', '==', groupId)
  );
  
  const attendanceSnapshot = await getDocs(attendanceQuery);
  const attendanceMap = new Map();
  
  attendanceSnapshot.forEach(doc => {
    const data = doc.data();
    attendanceMap.set(data.userId, {
      isAttending: data.isAttending,
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
      location: data.location
    });
  });
  
  return attendanceMap;
}

/**
 * Subscribe to real-time attendance updates for a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToGroupAttendance(db, groupId, callback) {
  const attendanceQuery = query(
    collection(db, 'groupAttendance'),
    where('groupId', '==', groupId)
  );
  
  return onSnapshot(attendanceQuery, (snapshot) => {
    const attendanceMap = new Map();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      attendanceMap.set(data.userId, {
        isAttending: data.isAttending,
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
        location: data.location
      });
    });
    
    callback(attendanceMap);
  });
}