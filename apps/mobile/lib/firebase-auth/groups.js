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
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';

/**
 * Create a new group
 * @param {Object} db - Firestore instance
 * @param {string} creatorId - Creator's user ID
 * @param {Object} groupData - Group data (name, description, etc.)
 * @param {Array} initialMembers - Array of user IDs to add as initial members
 * @returns {Object} Created group object
 */
export async function createGroup(db, creatorId, groupData, initialMembers = []) {
  try {
    // Create group document
    const groupRef = await addDoc(collection(db, 'groups'), {
      name: groupData.name,
      description: groupData.description || '',
      createdBy: creatorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isPrivate: groupData.isPrivate || false,
      memberCount: initialMembers.length + 1, // +1 for creator
      maxMembers: groupData.maxMembers || 50
    });

    // Add creator as admin member
    await addDoc(collection(db, 'groupMembers'), {
      groupId: groupRef.id,
      userId: creatorId,
      role: 'admin',
      joinedAt: serverTimestamp(),
      isActive: true
    });

    // Add initial members
    for (const memberId of initialMembers) {
      await addDoc(collection(db, 'groupMembers'), {
        groupId: groupRef.id,
        userId: memberId,
        role: 'member',
        joinedAt: serverTimestamp(),
        isActive: true
      });
    }

    // Return group with ID
    return {
      id: groupRef.id,
      ...groupData,
      createdBy: creatorId,
      memberCount: initialMembers.length + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
}

/**
 * Get a specific group by ID
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @returns {Object} Group object
 */
export async function getGroup(db, groupId) {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      return { id: groupSnap.id, ...groupSnap.data() };
    }
    
    throw new Error('Group not found');
  } catch (error) {
    console.error('Error getting group:', error);
    throw error;
  }
}

/**
 * Get all groups for a user
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @returns {Array} Array of group objects
 */
export async function getUserGroups(db, userId) {
  try {
    // Get user's group memberships
    const membershipsQuery = query(
      collection(db, 'groupMembers'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    
    const membershipsSnapshot = await getDocs(membershipsQuery);
    const groups = [];
    
    // Get group details for each membership
    for (const membershipDoc of membershipsSnapshot.docs) {
      const membership = membershipDoc.data();
      const groupRef = doc(db, 'groups', membership.groupId);
      const groupSnap = await getDoc(groupRef);
      
      if (groupSnap.exists()) {
        groups.push({
          id: groupSnap.id,
          ...groupSnap.data(),
          userRole: membership.role,
          joinedAt: membership.joinedAt
        });
      }
    }
    
    return groups;
  } catch (error) {
    console.error('Error getting user groups:', error);
    throw error;
  }
}

/**
 * Get group members
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} requesterId - ID of user requesting (for permission check)
 * @returns {Array} Array of member objects
 */
export async function getGroupMembers(db, groupId, requesterId) {
  try {
    // Verify requester is a member
    const requesterMembershipQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', requesterId),
      where('isActive', '==', true)
    );
    
    const requesterSnapshot = await getDocs(requesterMembershipQuery);
    if (requesterSnapshot.empty) {
      throw new Error('Not authorized to view group members');
    }

    // Get all active members
    const membersQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('isActive', '==', true)
    );
    
    const membersSnapshot = await getDocs(membersQuery);
    const members = [];
    
    // Get user details for each member
    for (const memberDoc of membersSnapshot.docs) {
      const membership = memberDoc.data();
      const userRef = doc(db, 'users', membership.userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        members.push({
          id: membership.userId,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          role: membership.role,
          joinedAt: membership.joinedAt,
          membershipId: memberDoc.id
        });
      }
    }
    
    return members;
  } catch (error) {
    console.error('Error getting group members:', error);
    throw error;
  }
}

/**
 * Update group information
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID (for permission check)
 * @returns {Object} Updated group object
 */
export async function updateGroup(db, groupId, updateData, userId) {
  try {
    // Verify user is admin
    const membershipQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      where('role', '==', 'admin'),
      where('isActive', '==', true)
    );
    
    const membershipSnapshot = await getDocs(membershipQuery);
    if (membershipSnapshot.empty) {
      throw new Error('Not authorized to update group');
    }

    // Update group
    const groupRef = doc(db, 'groups', groupId);
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.createdBy;
    
    await updateDoc(groupRef, {
      ...safeUpdateData,
      updatedAt: serverTimestamp()
    });
    
    // Return updated group
    return await getGroup(db, groupId);
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
}

/**
 * Add a member to a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} newMemberId - User ID to add
 * @param {string} addedBy - User ID of person adding the member
 * @param {string} role - Role for new member ('member' or 'admin')
 * @returns {Object} Result object
 */
export async function addGroupMember(db, groupId, newMemberId, addedBy, role = 'member') {
  try {
    // Verify adder is admin
    const adderMembershipQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', addedBy),
      where('role', '==', 'admin'),
      where('isActive', '==', true)
    );
    
    const adderSnapshot = await getDocs(adderMembershipQuery);
    if (adderSnapshot.empty) {
      throw new Error('Not authorized to add members');
    }

    // Check if user is already a member
    const existingMemberQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', newMemberId),
      where('isActive', '==', true)
    );
    
    const existingSnapshot = await getDocs(existingMemberQuery);
    if (!existingSnapshot.empty) {
      throw new Error('User is already a member');
    }

    // Add new member
    await addDoc(collection(db, 'groupMembers'), {
      groupId,
      userId: newMemberId,
      role,
      joinedAt: serverTimestamp(),
      addedBy,
      isActive: true
    });

    // Update group member count
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const currentCount = groupSnap.data().memberCount || 0;
      await updateDoc(groupRef, {
        memberCount: currentCount + 1,
        updatedAt: serverTimestamp()
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding group member:', error);
    throw error;
  }
}

/**
 * Remove a member from a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} memberId - User ID to remove
 * @param {string} removedBy - User ID of person removing the member
 * @returns {Object} Result object
 */
export async function removeGroupMember(db, groupId, memberId, removedBy) {
  try {
    // Verify remover is admin or removing themselves
    if (removedBy !== memberId) {
      const removerMembershipQuery = query(
        collection(db, 'groupMembers'),
        where('groupId', '==', groupId),
        where('userId', '==', removedBy),
        where('role', '==', 'admin'),
        where('isActive', '==', true)
      );
      
      const removerSnapshot = await getDocs(removerMembershipQuery);
      if (removerSnapshot.empty) {
        throw new Error('Not authorized to remove members');
      }
    }

    // Find and deactivate membership
    const membershipQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', memberId),
      where('isActive', '==', true)
    );
    
    const membershipSnapshot = await getDocs(membershipQuery);
    if (membershipSnapshot.empty) {
      throw new Error('Member not found');
    }

    const membershipDoc = membershipSnapshot.docs[0];
    await updateDoc(membershipDoc.ref, {
      isActive: false,
      removedAt: serverTimestamp(),
      removedBy
    });

    // Update group member count
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const currentCount = groupSnap.data().memberCount || 1;
      await updateDoc(groupRef, {
        memberCount: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp()
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing group member:', error);
    throw error;
  }
}

/**
 * Leave a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID leaving
 * @returns {Object} Result object
 */
export async function leaveGroup(db, groupId, userId) {
  try {
    return await removeGroupMember(db, groupId, userId, userId);
  } catch (error) {
    console.error('Error leaving group:', error);
    throw error;
  }
}

/**
 * Delete a group (admin only)
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID (must be admin)
 * @returns {Object} Result object
 */
export async function deleteGroup(db, groupId, userId) {
  try {
    // Verify user is admin
    const membershipQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      where('role', '==', 'admin'),
      where('isActive', '==', true)
    );
    
    const membershipSnapshot = await getDocs(membershipQuery);
    if (membershipSnapshot.empty) {
      throw new Error('Not authorized to delete group');
    }

    // Deactivate all memberships
    const allMembersQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('isActive', '==', true)
    );
    
    const allMembersSnapshot = await getDocs(allMembersQuery);
    
    for (const memberDoc of allMembersSnapshot.docs) {
      await updateDoc(memberDoc.ref, {
        isActive: false,
        removedAt: serverTimestamp(),
        removedBy: userId
      });
    }

    // Mark group as deleted
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
}

/**
 * Subscribe to group updates
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToGroup(db, groupId, callback) {
  if (!groupId) return () => {};
  
  const groupRef = doc(db, 'groups', groupId);
  
  return onSnapshot(
    groupRef,
    (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("Error subscribing to group:", error);
      callback(null, error);
    }
  );
}

/**
 * Subscribe to group members updates
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToGroupMembers(db, groupId, callback) {
  if (!groupId) return () => {};
  
  const membersQuery = query(
    collection(db, 'groupMembers'),
    where('groupId', '==', groupId),
    where('isActive', '==', true)
  );
  
  return onSnapshot(
    membersQuery,
    async (snapshot) => {
      const members = [];
      
      for (const memberDoc of snapshot.docs) {
        const membership = memberDoc.data();
        const userRef = doc(db, 'users', membership.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          members.push({
            id: membership.userId,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            role: membership.role,
            joinedAt: membership.joinedAt,
            membershipId: memberDoc.id
          });
        }
      }
      
      callback(members);
    },
    (error) => {
      console.error("Error subscribing to group members:", error);
      callback([], error);
    }
  );
} 