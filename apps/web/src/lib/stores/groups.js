// apps/web/src/lib/stores/groups.js
import { writable, derived, get } from 'svelte/store';
import { getFirestore } from 'firebase/firestore';
import { authStore } from './auth';
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
  inviteUserToGroup,
  getUserInvites,
  acceptGroupInvite,
  declineGroupInvite,
  cancelGroupInvite,
  leaveGroup
} from '$firebase-auth/groups';

// Initial state
const initialState = {
  groups: [],
  currentGroup: null,
  currentGroupMembers: [],
  invites: [],
  loading: false,
  error: null,
  lastUpdated: null
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

// Reset store when user logs out
authStore.subscribe(auth => {
  if (!auth.user) {
    groupsStore.set(initialState);
  }
});

/**
 * Load all groups for the current user
 */
export async function loadUserGroups() {
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
  
  groupsStore.update(state => ({
    ...state,
    loading: true,
    error: null
  }));
  
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
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated'
    }));
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
 * Add a member to the current group
 * @param {string} userId - User ID to add
 */
export async function addMember(userId) {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    const updatedGroup = await addGroupMember(
      db,
      state.currentGroup.id,
      userId,
      auth.user.uid
    );
    
    // Update the current group
    groupsStore.update(state => ({
      ...state,
      currentGroup: updatedGroup,
      loading: false,
      lastUpdated: new Date()
    }));
    
    // Reload group members to reflect the change
    await loadGroupMembers(state.currentGroup.id);
    
    return true;
  } catch (error) {
    console.error('Error adding member to group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Remove a member from the current group
 * @param {string} userId - User ID to remove
 */
export async function removeMember(userId) {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    const updatedGroup = await removeGroupMember(
      db,
      state.currentGroup.id,
      userId,
      auth.user.uid
    );
    
    // Update the current group
    groupsStore.update(state => ({
      ...state,
      currentGroup: updatedGroup,
      loading: false,
      lastUpdated: new Date()
    }));
    
    // Update members list by removing the user
    groupsStore.update(state => ({
      ...state,
      currentGroupMembers: state.currentGroupMembers.filter(member => member.id !== userId)
    }));
    
    return true;
  } catch (error) {
    console.error('Error removing member from group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Promote a member to admin
 * @param {string} userId - User ID to promote
 */
export async function promoteMemberToAdmin(userId) {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    const updatedGroup = await promoteToAdmin(
      db,
      state.currentGroup.id,
      userId,
      auth.user.uid
    );
    
    // Update the current group
    groupsStore.update(state => ({
      ...state,
      currentGroup: updatedGroup,
      loading: false,
      lastUpdated: new Date()
    }));
    
    // Update the member in the members list
    groupsStore.update(state => ({
      ...state,
      currentGroupMembers: state.currentGroupMembers.map(member => 
        member.id === userId 
          ? { ...member, role: 'admin', isAdmin: true } 
          : member
      )
    }));
    
    return true;
  } catch (error) {
    console.error('Error promoting member to admin:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Demote an admin to regular member
 * @param {string} userId - User ID to demote
 */
export async function demoteAdminToMember(userId) {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    const updatedGroup = await demoteFromAdmin(
      db,
      state.currentGroup.id,
      userId,
      auth.user.uid
    );
    
    // Update the current group
    groupsStore.update(state => ({
      ...state,
      currentGroup: updatedGroup,
      loading: false,
      lastUpdated: new Date()
    }));
    
    // Update the member in the members list
    groupsStore.update(state => ({
      ...state,
      currentGroupMembers: state.currentGroupMembers.map(member => 
        member.id === userId 
          ? { ...member, role: 'member', isAdmin: false } 
          : member
      )
    }));
    
    return true;
  } catch (error) {
    console.error('Error demoting admin to member:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Delete the current group
 */
export async function deleteCurrentGroup() {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    await deleteGroup(db, state.currentGroup.id, auth.user.uid);
    
    // Remove the group from the list
    groupsStore.update(state => ({
      ...state,
      groups: state.groups.filter(group => group.id !== state.currentGroup.id),
      currentGroup: null,
      currentGroupMembers: [],
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error deleting group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Invite a user to the current group
 * @param {string} userEmail - Email of user to invite
 * @param {string} message - Optional message
 */
export async function inviteUser(userEmail, message = '') {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    const invite = await inviteUserToGroup(
      db,
      state.currentGroup.id,
      userEmail,
      auth.user.uid,
      message
    );
    
    groupsStore.update(state => ({
      ...state,
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error inviting user to group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
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
 * Leave the current group
 */
export async function leaveCurrentGroup() {
  const auth = get(authStore);
  const state = get(groupsStore);
  
  if (!auth.user || !state.currentGroup) {
    groupsStore.update(state => ({
      ...state,
      error: 'User not authenticated or no group selected'
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
    await leaveGroup(db, state.currentGroup.id, auth.user.uid);
    
    // Remove the group from the list
    groupsStore.update(state => ({
      ...state,
      groups: state.groups.filter(group => group.id !== state.currentGroup.id),
      currentGroup: null,
      currentGroupMembers: [],
      loading: false,
      lastUpdated: new Date()
    }));
    
    return true;
  } catch (error) {
    console.error('Error leaving group:', error);
    groupsStore.update(state => ({
      ...state,
      loading: false,
      error: error.message
    }));
    return false;
  }
}

// Export the store
export { groupsStore };