// apps/web/src/lib/firebase-auth/groups.js - Updated with new features
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
 * Create a new group with initial members
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
    invites: [], // No invites initially
    attendanceSettings: {
      allowSelfToggle: true,
      adminCanReset: true
    }
  };
  
  // Save the group
  await setDoc(groupRef, newGroup);
  
  // Create group membership records for each member
  for (const memberId of memberIds) {
    // Get user's default address to set as initial selection
    let defaultAddressId = null;
    try {
      // Load addresses from userAddresses collection
      const addressesQuery = query(
        collection(db, 'userAddresses'),
        where('userId', '==', memberId)
      );
      const addressesSnapshot = await getDocs(addressesQuery);
      const userAddresses = [];
      
      addressesSnapshot.forEach(doc => {
        userAddresses.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      if (userAddresses.length > 0) {
        // Find default address
        const defaultAddr = userAddresses.find(addr => addr.isDefault);
        if (defaultAddr) {
          defaultAddressId = defaultAddr.id;
        } else {
          // If no default, use the first address
          defaultAddressId = userAddresses[0].id;
        }
      }
    } catch (error) {
      console.error(`Error getting default address for user ${memberId}:`, error);
    }

    const membershipRef = doc(collection(db, 'groupMemberships'));
    await setDoc(membershipRef, {
      id: membershipRef.id,
      userId: memberId,
      groupId: groupRef.id,
      role: memberId === creatorId ? 'admin' : 'member',
      joinedAt: serverTimestamp(),
      selectedAddressId: defaultAddressId, // Auto-set default address
      active: true
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
    where('userId', '==', userId),
    where('active', '==', true)
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
 * Add friends directly to a group (no invitation needed)
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Array} friendIds - Array of friend user IDs to add
 * @param {string} addedBy - User ID adding (must be member)
 * @returns {Array} - Array of add results
 */
export async function addFriendsToGroup(db, groupId, friendIds, addedBy) {
  // Check if the adding user is a member
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(addedBy)) {
    throw new Error('Only group members can add friends');
  }
  
  // Get user's friends to verify friendship
  const userFriends = await getFriends(db, addedBy);
  const friendIdSet = new Set(userFriends.map(f => f.id));
  
  const results = [];
  
  for (const friendId of friendIds) {
    try {
      // Verify friendship
      if (!friendIdSet.has(friendId)) {
        results.push({
          friendId,
          status: 'not_friend',
          error: 'User is not in your friends list'
        });
        continue;
      }
      
      // Check if friend is already a member
      if (group.members.includes(friendId)) {
        results.push({
          friendId,
          status: 'already_member'
        });
        continue;
      }
      
      // Add friend directly to the group
      await addGroupMember(db, groupId, friendId, addedBy);
      
      results.push({
        friendId,
        status: 'added'
      });
      
    } catch (error) {
      results.push({
        friendId,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Invite friends to a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Array} friendIds - Array of friend user IDs to invite
 * @param {string} invitedBy - User ID inviting (must be member)
 * @param {string} message - Optional message
 * @returns {Array} - Array of invite results
 */
export async function inviteFriendsToGroup(db, groupId, friendIds, invitedBy, message = '') {
  // Check if the inviting user is a member
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(invitedBy)) {
    throw new Error('Only group members can invite others');
  }
  
  // Get user's friends to verify friendship
  const userFriends = await getFriends(db, invitedBy);
  const friendIdSet = new Set(userFriends.map(f => f.id));
  
  const results = [];
  
  for (const friendId of friendIds) {
    try {
      // Verify friendship
      if (!friendIdSet.has(friendId)) {
        results.push({
          friendId,
          status: 'not_friend',
          error: 'User is not in your friends list'
        });
        continue;
      }
      
      // Check if friend is already a member
      if (group.members.includes(friendId)) {
        results.push({
          friendId,
          status: 'already_member'
        });
        continue;
      }
      
      // Check for existing pending invites
      const existingInviteQuery = query(
        collection(db, 'groupInvites'),
        where('groupId', '==', groupId),
        where('userId', '==', friendId),
        where('status', '==', 'pending')
      );
      
      const existingInvites = await getDocs(existingInviteQuery);
      
      if (!existingInvites.empty) {
        results.push({
          friendId,
          status: 'already_invited'
        });
        continue;
      }
      
      // Get friend's details
      const friendRef = doc(db, 'users', friendId);
      const friendSnap = await getDoc(friendRef);
      const friendData = friendSnap.exists() ? friendSnap.data() : {};
      
      // Create the invite
      const inviteRef = doc(collection(db, 'groupInvites'));
      
      const inviteData = {
        id: inviteRef.id,
        groupId,
        groupName: group.name,
        userId: friendId,
        phoneNumber: friendData.phoneNumber || null,
        userEmail: friendData.email || null,
        invitedBy,
        inviterName: await getUserDisplayName(db, invitedBy),
        message,
        status: 'pending',
        type: 'friend',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(inviteRef, inviteData);
      
      // Add to group's invites array
      await updateDoc(doc(db, 'groups', groupId), {
        invites: arrayUnion(inviteRef.id),
        updatedAt: serverTimestamp()
      });
      
      results.push({
        friendId,
        status: 'invited',
        inviteId: inviteRef.id
      });
      
    } catch (error) {
      results.push({
        friendId,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Invite users to a group by phone number
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {Array} phoneInvites - Array of {phoneNumber, name} objects
 * @param {string} invitedBy - User ID inviting (must be member)
 * @param {string} message - Optional message
 * @returns {Array} - Array of invite results
 */
export async function inviteUsersByPhone(db, groupId, phoneInvites, invitedBy, message = '') {
  // Check if the inviting user is a member
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(invitedBy)) {
    throw new Error('Only group members can invite others');
  }
  
  const results = [];
  
  for (const { phoneNumber, name } of phoneInvites) {
    try {
      // Find user by phone number
      const userQuery = query(
        collection(db, 'users'),
        where('phoneNumber', '==', phoneNumber),
        limit(1)
      );
      
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        // Create a pending invite for unregistered user
        const inviteRef = doc(collection(db, 'groupInvites'));
        
        const inviteData = {
          id: inviteRef.id,
          groupId,
          groupName: group.name,
          phoneNumber,
          inviteeName: name,
          userId: null, // No userId yet
          invitedBy,
          inviterName: await getUserDisplayName(db, invitedBy),
          message,
          status: 'pending',
          type: 'phone', // Distinguish from friend invites
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(inviteRef, inviteData);
        
        results.push({
          phoneNumber,
          name,
          status: 'invited',
          inviteId: inviteRef.id,
          registered: false
        });
      } else {
        const user = userSnapshot.docs[0];
        const userId = user.id;
        
        // Check if user is already a member
        if (group.members.includes(userId)) {
          results.push({
            phoneNumber,
            name,
            status: 'already_member',
            registered: true
          });
          continue;
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
          results.push({
            phoneNumber,
            name,
            status: 'already_invited',
            registered: true
          });
          continue;
        }
        
        // Create the invite
        const inviteRef = doc(collection(db, 'groupInvites'));
        
        const inviteData = {
          id: inviteRef.id,
          groupId,
          groupName: group.name,
          userId,
          phoneNumber,
          userEmail: user.data().email || null,
          invitedBy,
          inviterName: await getUserDisplayName(db, invitedBy),
          message,
          status: 'pending',
          type: 'phone',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(inviteRef, inviteData);
        
        // Add to group's invites array
        await updateDoc(doc(db, 'groups', groupId), {
          invites: arrayUnion(inviteRef.id),
          updatedAt: serverTimestamp()
        });
        
        results.push({
          phoneNumber,
          name,
          status: 'invited',
          inviteId: inviteRef.id,
          registered: true
        });
      }
    } catch (error) {
      results.push({
        phoneNumber,
        name,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Set user's selected address for a group
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @param {string} addressId - Address ID from user's saved addresses
 * @returns {Object} - Updated membership data
 */
export async function setUserGroupAddress(db, groupId, userId, addressId) {
  // Verify user is a member
  const group = await getGroup(db, groupId);
  
  if (!group.members.includes(userId)) {
    throw new Error('You must be a member of this group');
  }
  
  // Find the user's membership record
  const membershipQuery = query(
    collection(db, 'groupMemberships'),
    where('groupId', '==', groupId),
    where('userId', '==', userId),
    where('active', '==', true)
  );
  
  const memberships = await getDocs(membershipQuery);
  
  if (memberships.empty) {
    throw new Error('Membership not found');
  }
  
  const membershipRef = memberships.docs[0].ref;
  
  await updateDoc(membershipRef, {
    selectedAddressId: addressId,
    updatedAt: serverTimestamp()
  });
  
  return {
    groupId,
    userId,
    addressId,
    updatedAt: new Date()
  };
}

/**
 * Reset attendance for all group members (admin only)
 * @param {Object} db - Firestore instance
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID performing the reset (must be admin)
 * @returns {boolean} - Success
 */
export async function resetGroupAttendance(db, groupId, userId) {
  // Verify user is an admin
  const group = await getGroup(db, groupId);
  
  if (!group.admins.includes(userId)) {
    throw new Error('Only group admins can reset attendance');
  }
  
  // Get all attendance records for this group
  const attendanceQuery = query(
    collection(db, 'groupAttendance'),
    where('groupId', '==', groupId)
  );
  
  const attendanceSnapshot = await getDocs(attendanceQuery);
  
  // Delete all attendance records
  const deletePromises = [];
  attendanceSnapshot.forEach(doc => {
    deletePromises.push(deleteDoc(doc.ref));
  });
  
  await Promise.all(deletePromises);
  
  return true;
}

/**
 * Get all members of a group with their profiles, addresses, and attendance
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
  
  // Get memberships to get roles and selected addresses
  const membershipQuery = query(
    collection(db, 'groupMemberships'),
    where('groupId', '==', groupId),
    where('active', '==', true)
  );
  
  const memberships = await getDocs(membershipQuery);
  const membershipMap = new Map();
  
  memberships.forEach(doc => {
    const data = doc.data();
    membershipMap.set(data.userId, {
      role: data.role,
      joinedAt: data.joinedAt ? data.joinedAt.toDate() : null,
      selectedAddressId: data.selectedAddressId
    });
  });
  
  // Get attendance data
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
  
  // Get addresses for all members individually (needed for meeting point calculation)
  // We fetch addresses individually to work within Firestore security rules
  const addressesByUser = new Map();
  
  await Promise.all(
    group.members.map(async (memberId) => {
      try {
        const memberAddressesQuery = query(
          collection(db, 'userAddresses'),
          where('userId', '==', memberId)
        );
        
        const memberAddressesSnapshot = await getDocs(memberAddressesQuery);
        const memberAddresses = [];
        
        memberAddressesSnapshot.forEach(doc => {
          memberAddresses.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        if (memberAddresses.length > 0) {
          addressesByUser.set(memberId, memberAddresses);
        }
      } catch (error) {
        console.error(`Error fetching addresses for member ${memberId}:`, error);
        // Continue with other members even if one fails
      }
    })
  );
  
  // Get the profile information for each member
  const memberProfiles = await Promise.all(
    group.members.map(async (memberId) => {
      const memberRef = doc(db, 'users', memberId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        const userData = memberSnap.data();
        const isFriend = friendIds.includes(memberId) || memberId === currentUserId;
        const membership = membershipMap.get(memberId) || { role: 'member' };
        const attendance = attendanceMap.get(memberId) || { isAttending: false };
        const userAddresses = addressesByUser.get(memberId) || [];
        
        return {
          id: memberId,
          displayName: userData.displayName || 'Unknown User',
          phoneNumber: userData.phoneNumber || null,
          photoURL: userData.photoURL || null,
          email: userData.email || null,
          role: membership.role,
          isAdmin: membership.role === 'admin',
          isCreator: group.creatorId === memberId,
          joinedAt: membership.joinedAt,
          selectedAddressId: membership.selectedAddressId,
          attendance: attendance,
          // Include address info for all group members (needed for meeting point calculation)
          homeAddress: userData.homeAddress || null,
          savedAddresses: userAddresses, // Load from userAddresses collection
          // Keep track of friendship status for UI purposes
          isFriend: isFriend,
          // Flag to indicate if this user's address should be used for calculations
          canUseAddressForMeetingPoint: attendance.isAttending && (
            // Has a selected address for this group
            (membership.selectedAddressId && userAddresses.some(addr => addr.id === membership.selectedAddressId)) ||
            // Or has a home address as fallback
            userData.homeAddress
          )
        };
      }
      
      // Member document doesn't exist (rare case)
      const membership = membershipMap.get(memberId) || { role: 'member' };
      const attendance = attendanceMap.get(memberId) || { isAttending: false };
      
      return {
        id: memberId,
        displayName: 'Unknown User',
        role: membership.role,
        isAdmin: membership.role === 'admin',
        isCreator: group.creatorId === memberId,
        attendance: attendance,
        isFriend: false,
        error: 'User profile not found'
      };
    })
  );
  
  return memberProfiles;
}

// Helper function to get user display name
async function getUserDisplayName(db, userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data().displayName || 'A user';
    }
    
    return 'A user';
  } catch (error) {
    return 'A user';
  }
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
  
  // Get user's default address to set as initial selection
  let defaultAddressId = null;
  try {
    // Load addresses from userAddresses collection
    const addressesQuery = query(
      collection(db, 'userAddresses'),
      where('userId', '==', userId)
    );
    const addressesSnapshot = await getDocs(addressesQuery);
    const userAddresses = [];
    
    addressesSnapshot.forEach(doc => {
      userAddresses.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    if (userAddresses.length > 0) {
      // Find default address
      const defaultAddr = userAddresses.find(addr => addr.isDefault);
      if (defaultAddr) {
        defaultAddressId = defaultAddr.id;
      } else {
        // If no default, use the first address
        defaultAddressId = userAddresses[0].id;
      }
    }
  } catch (error) {
    console.error(`Error getting default address for user ${userId}:`, error);
  }

  // Create membership record
  const membershipRef = doc(collection(db, 'groupMemberships'));
  await setDoc(membershipRef, {
    id: membershipRef.id,
    userId: userId,
    groupId: groupId,
    role: 'member',
    addedBy: addedBy,
    joinedAt: serverTimestamp(),
    selectedAddressId: defaultAddressId, // Auto-set default address
    active: true
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
    where('userId', '==', userId),
    where('active', '==', true)
  );
  
  const memberships = await getDocs(membershipQuery);
  
  memberships.forEach(async (membership) => {
    const membershipRef = doc(db, 'groupMemberships', membership.id);
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
    where('userId', '==', userId),
    where('active', '==', true)
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
    where('userId', '==', userId),
    where('active', '==', true)
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
 * Get all pending invites for a user
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {string} type - Type of requests: 'incoming', 'outgoing', or 'all'
 * @param {string} status - Status of requests: 'pending', 'accepted', 'rejected', or 'all'
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