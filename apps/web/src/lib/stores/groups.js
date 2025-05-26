// apps/web/src/lib/stores/groups.js - Updated with new features
import { writable, derived, get } from 'svelte/store';
import { getFirestore } from 'firebase/firestore';
import { authStore } from './auth';
import { goto } from '$app/navigation';
import { 
  createGroup,
  getGroup,
  getUserGroups,
  getGroupMembers,
  updateGroup,
  addGroupMember,
  removeGroupMember,
  promoteToAdmin,
  demoteFromAdmin,
  deleteGroup,
  addFriendsToGroup,
  inviteFriendsToGroup,
  inviteUsersByPhone,
  getUserInvites,
  acceptGroupInvite,
  declineGroupInvite,
  cancelGroupInvite,
  leaveGroup,
  saveMeetingPoint,
  setUserGroupAddress,
  resetGroupAttendance,
  getGroupAttendance,
  updateAttendanceStatus,
  subscribeToGroupAttendance
} from '$firebase-auth/groups';

// Initial state
const initialState = {
  groups: [],
  currentGroup: null,
  currentGroupMembers: [],
  invites: [],
  loading: false,
  error: null,
  lastUpdated: null,
  attendance: new Map(), // Map of userId -> { isAttending, updatedAt, location }
  attendanceUnsubscribe: null
};

// Create the store
const groupsStore = writable(initialState);

// Create derived stores for convenience
export const groups = derived(groupsStore, $store => $store.groups);
export const currentGroup = derived(groupsStore, $store => $store.currentGroup);
export const currentGroupMembers = derived(groupsStore, $store => $store.currentGroupMembers);
export const groupInvites = derived(groupsStore, $store => $store.invites);
export const isLoading = derived(groupsStore, $store => $store.loading);
export const error = derived(groupsStore, $store => $store.error);
export const attendance = derived(groupsStore, $store => $store.attendance);

// Reset store when user logs out
authStore.subscribe(auth => {
  if (!auth.user) {
    unsubscribeFromAttendance();
    groupsStore.set(initialState);
  }
});

/**
 * Load all groups for the current user
 */
export async function loadUserGroups() {
  const auth = get(authStore);
  
  if (!auth.user) {
    const redirect = encodeURIComponent(window.location.pathname);
    goto(`/auth/login?redirect=${redirect}`);
    return;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const userGroupsList = await getUserGroups(db, auth.user.uid);
    
    groupsStore.update(state => ({
      ...state,
      groups: userGroupsList,
      loading: false,
      lastUpdated: new Date()
    }));
  } catch (error) {
    console.error('Error loading user groups:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
  }
}

/**
 * Load a specific group by ID
 * @param {string} groupId - Group ID to load
 */
export async function loadGroup(groupId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const groupData = await getGroup(db, groupId);
    
    groupsStore.update(state => ({
      ...state,
      currentGroup: groupData,
      loading: false
    }));
    
    // Also load the group members
    await loadGroupMembers(groupId);
    
  } catch (error) {
    console.error(`Error loading group ${groupId}:`, error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
  }
}

/**
 * Load members of the current group
 * @param {string} groupId - Group ID
 */
export async function loadGroupMembers(groupId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return;
  }
  
  try {
    const db = getFirestore();
    const members = await getGroupMembers(db, groupId, auth.user.uid);
    
    groupsStore.update(state => ({
      ...state,
      currentGroupMembers: members,
      loading: false
    }));
  } catch (error) {
    console.error(`Error loading members for group ${groupId}:`, error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
  }
}

/**
 * Create a new group
 * @param {Object} groupData - Group data including name and description
 * @param {Array} initialMembers - Array of user IDs to add as initial members
 */
export async function createNewGroup(groupData, initialMembers = []) {
  const auth = get(authStore);
  
  if (!auth.user) {
    const redirect = encodeURIComponent(window.location.pathname);
    goto(`/auth/login?redirect=${redirect}`);
    return null;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const newGroup = await createGroup(db, auth.user.uid, groupData, initialMembers);
    
    // Update the groups list
    groupsStore.update(state => {
      const updatedGroups = [...state.groups, newGroup];
      
      return {
        ...state,
        groups: updatedGroups,
        currentGroup: newGroup,
        loading: false,
        lastUpdated: new Date()
      };
    });
    
    return newGroup;
  } catch (error) {
    console.error('Error creating group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return null;
  }
}

/**
 * Update a group's information
 * @param {string} groupId - Group ID
 * @param {Object} updateData - Data to update (name, description)
 */
export async function updateGroupInfo(groupId, updateData) {
  const auth = get(authStore);
  
  if (!auth.user) {
    const redirect = encodeURIComponent(window.location.pathname);
    goto(`/auth/login?redirect=${redirect}`);
    return false;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const updatedGroup = await updateGroup(db, groupId, updateData, auth.user.uid);
    
    // Update both the groups list and current group
    groupsStore.update(state => {
      const updatedGroups = state.groups.map(group => 
        group.id === groupId ? updatedGroup : group
      );
      
      return {
        ...state,
        groups: updatedGroups,
        currentGroup: state.currentGroup?.id === groupId ? updatedGroup : state.currentGroup,
        loading: false,
        lastUpdated: new Date()
      };
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating group ${groupId}:`, error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Add friends directly to a group (no invitation needed)
 * @param {string} groupId - Group ID
 * @param {Array} friendIds - Array of friend user IDs to add
 */
export async function addFriends(groupId, friendIds) {
  const auth = get(authStore);
  
  if (!auth.user) {
    const redirect = encodeURIComponent(window.location.pathname);
    goto(`/auth/login?redirect=${redirect}`);
    return [];
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const results = await addFriendsToGroup(db, groupId, friendIds, auth.user.uid);
    
    groupsStore.update(state => ({
      ...state,
      loading: false,
      lastUpdated: new Date()
    }));
    
    // Reload group members to show the new additions
    await loadGroupMembers(groupId);
    
    return results;
  } catch (error) {
    console.error('Error adding friends to group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return [];
  }
}

/**
 * Invite friends to a group
 * @param {string} groupId - Group ID
 * @param {Array} friendIds - Array of friend user IDs to invite
 * @param {string} message - Optional message
 */
export async function inviteFriends(groupId, friendIds, message = '') {
  const auth = get(authStore);
  
  if (!auth.user) {
    const redirect = encodeURIComponent(window.location.pathname);
    goto(`/auth/login?redirect=${redirect}`);
    return [];
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const results = await inviteFriendsToGroup(db, groupId, friendIds, auth.user.uid, message);
    
    groupsStore.update(state => ({
      ...state,
      loading: false,
      lastUpdated: new Date()
    }));
    
    return results;
  } catch (error) {
    console.error('Error inviting friends to group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return [];
  }
}

/**
 * Invite users by phone number
 * @param {string} groupId - Group ID
 * @param {Array} phoneInvites - Array of {phoneNumber, name} objects
 * @param {string} message - Optional message
 */
export async function inviteByPhone(groupId, phoneInvites, message = '') {
  const auth = get(authStore);
  
  if (!auth.user) {
    const redirect = encodeURIComponent(window.location.pathname);
    goto(`/auth/login?redirect=${redirect}`);
    return [];
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const results = await inviteUsersByPhone(db, groupId, phoneInvites, auth.user.uid, message);
    
    groupsStore.update(state => ({
      ...state,
      loading: false,
      lastUpdated: new Date()
    }));
    
    return results;
  } catch (error) {
    console.error('Error inviting users by phone:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return [];
  }
}

/**
 * Set user's selected address for a group
 * @param {string} groupId - Group ID
 * @param {string} addressId - Address ID
 */
export async function setMyGroupAddress(groupId, addressId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  try {
    const db = getFirestore();
    await setUserGroupAddress(db, groupId, auth.user.uid, addressId);
    
    // Update the current group members to reflect the change
    await loadGroupMembers(groupId);
    
    return true;
  } catch (error) {
    console.error('Error setting group address:', error);
    groupsStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

/**
 * Reset attendance for all group members (admin only)
 * @param {string} groupId - Group ID
 */
export async function resetAttendance(groupId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    await resetGroupAttendance(db, groupId, auth.user.uid);
    
    // Clear local attendance state
    groupsStore.update(state => ({
      ...state,
      attendance: new Map(),
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error resetting attendance:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Update current user's attendance status
 * @param {string} groupId - Group ID
 * @param {boolean} isAttending - Whether user is attending
 * @param {Object} location - User's location (optional)
 */
export async function updateMyAttendance(groupId, isAttending, location = null) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  try {
    const db = getFirestore();
    await updateAttendanceStatus(db, groupId, auth.user.uid, isAttending, location);
    
    // Update local state immediately for responsiveness
    groupsStore.update(state => {
      const newAttendance = new Map(state.attendance);
      newAttendance.set(auth.user.uid, {
        isAttending,
        updatedAt: new Date(),
        location
      });
      
      return {
        ...state,
        attendance: newAttendance
      };
    });
    
    return true;
  } catch (error) {
    console.error('Error updating attendance:', error);
    groupsStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

/**
 * Load and subscribe to attendance updates for a group
 * @param {string} groupId - Group ID
 */
export async function subscribeToAttendance(groupId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    return;
  }
  
  try {
    const db = getFirestore();
    
    // Unsubscribe from previous subscription
    const state = get(groupsStore);
    if (state.attendanceUnsubscribe) {
      state.attendanceUnsubscribe();
    }
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToGroupAttendance(db, groupId, (attendanceMap) => {
      groupsStore.update(state => ({
        ...state,
        attendance: attendanceMap
      }));
    });
    
    groupsStore.update(state => ({
      ...state,
      attendanceUnsubscribe: unsubscribe
    }));
    
  } catch (error) {
    console.error('Error subscribing to attendance:', error);
    groupsStore.update(state => ({
      ...state,
      error: error.message
    }));
  }
}

/**
 * Unsubscribe from attendance updates
 */
export function unsubscribeFromAttendance() {
  const state = get(groupsStore);
  if (state.attendanceUnsubscribe) {
    state.attendanceUnsubscribe();
    groupsStore.update(state => ({
      ...state,
      attendanceUnsubscribe: null,
      attendance: new Map()
    }));
  }
}

/**
 * Load all group invites for the current user
 */
export async function loadGroupInvites() {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const invitesList = await getUserInvites(db, auth.user.uid);
    
    groupsStore.update(state => ({
      ...state,
      invites: invitesList,
      loading: false,
      lastUpdated: new Date()
    }));
  } catch (error) {
    console.error('Error loading group invites:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
  }
}

/**
 * Accept a group invite
 * @param {string} inviteId - Invite ID
 */
export async function acceptInvite(inviteId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    const group = await acceptGroupInvite(db, inviteId, auth.user.uid);
    
    // Update invites list and add group to groups list
    groupsStore.update(state => {
      const updatedInvites = state.invites.filter(invite => invite.id !== inviteId);
      const updatedGroups = [...state.groups, group];
      
      return {
        ...state,
        groups: updatedGroups,
        invites: updatedInvites,
        loading: false,
        lastUpdated: new Date()
      };
    });
    
    return true;
  } catch (error) {
    console.error('Error accepting group invite:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Decline a group invite
 * @param {string} inviteId - Invite ID
 */
export async function declineInvite(inviteId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
  try {
    const db = getFirestore();
    await declineGroupInvite(db, inviteId, auth.user.uid);
    
    // Update invites list
    groupsStore.update(state => ({
      ...state,
      invites: state.invites.filter(invite => invite.id !== inviteId),
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error declining group invite:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Fix missing default addresses for all group members (admin only)
 * @param {string} groupId - Group ID
 */
export async function fixGroupMemberAddresses(groupId) {
  const auth = get(authStore);
  
  if (!auth.user) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
    return false;
  }
  
  try {
    const db = getFirestore();
    
    // Check if user is admin of the group
    const group = await getGroup(db, groupId);
    if (!group.admins.includes(auth.user.uid)) {
      groupsStore.update(state => ({
        ...state,
        error: 'Only group admins can fix member addresses'
      }));
      return false;
    }
    
    // Get current group members
    const members = await getGroupMembers(db, groupId, auth.user.uid);
    
    let fixedCount = 0;
    
    for (const member of members) {
      // Skip if member already has a selected address
      if (member.selectedAddressId) continue;
      
      // Skip if member has no saved addresses
      if (!member.savedAddresses || member.savedAddresses.length === 0) continue;
      
      // Find default address or use first one
      const defaultAddr = member.savedAddresses.find(addr => addr.isDefault) || member.savedAddresses[0];
      
      if (defaultAddr) {
        try {
          // Set the default address for this member
          await setUserGroupAddress(db, groupId, member.id, defaultAddr.id);
          fixedCount++;
          console.log(`Fixed address for ${member.displayName}`);
        } catch (error) {
          console.error(`Error setting address for ${member.displayName}:`, error);
        }
      }
    }
    
    // Reload group members to reflect changes
    await loadGroupMembers(groupId);
    
    console.log(`Fixed addresses for ${fixedCount} members`);
    return true;
    
  } catch (error) {
    console.error('Error fixing group member addresses:', error);
    groupsStore.update(state => ({
      ...state,
      error: error.message
    }));
    return false;
  }
}

/**
 * Save meeting point for a group
 * @param {string} groupId - Group ID
 * @param {Object} meetingPointData - Meeting point data
 */
export async function saveMeetingPointForGroup(groupId, meetingPointData) {
  const auth = get(authStore);
  
  if (!auth.user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const db = getFirestore();
    return await saveMeetingPoint(db, groupId, meetingPointData, auth.user.uid);
  } catch (error) {
    console.error('Error saving meeting point:', error);
    throw error;
  }
}

export {
  addGroupMember as addMember,
  removeGroupMember as removeMember,
  promoteToAdmin as promoteMemberToAdmin,
  demoteFromAdmin as demoteAdminToMember,
  deleteGroup as deleteCurrentGroup,
  leaveGroup as leaveCurrentGroup,
  resetGroupAttendance as resetGroupAttendance
} from '$firebase-auth/groups';

// Export the store
export { groupsStore };