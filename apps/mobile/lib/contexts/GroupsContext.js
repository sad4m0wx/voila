import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { groupsService } from '../services/groupsService';

// Initial state
const initialState = {
  groups: [],
  currentGroup: null,
  currentGroupMembers: [],
  invites: [],
  loading: false,
  error: null,
  lastUpdated: null,
  attendance: new Map(),
  attendanceUnsubscribe: null
};

// Action types
const GroupsActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_GROUPS: 'SET_GROUPS',
  SET_CURRENT_GROUP: 'SET_CURRENT_GROUP',
  SET_CURRENT_GROUP_MEMBERS: 'SET_CURRENT_GROUP_MEMBERS',
  SET_INVITES: 'SET_INVITES',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_ATTENDANCE: 'SET_ATTENDANCE',
  ADD_GROUP: 'ADD_GROUP',
  UPDATE_GROUP: 'UPDATE_GROUP',
  REMOVE_GROUP: 'REMOVE_GROUP',
  ADD_INVITE: 'ADD_INVITE',
  REMOVE_INVITE: 'REMOVE_INVITE',
  RESET_STATE: 'RESET_STATE'
};

// Reducer
function groupsReducer(state, action) {
  switch (action.type) {
    case GroupsActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    case GroupsActionTypes.SET_GROUPS:
      return { ...state, groups: action.payload, loading: false, lastUpdated: new Date() };
    case GroupsActionTypes.SET_CURRENT_GROUP:
      return { ...state, currentGroup: action.payload, loading: false };
    case GroupsActionTypes.SET_CURRENT_GROUP_MEMBERS:
      return { ...state, currentGroupMembers: action.payload, loading: false };
    case GroupsActionTypes.SET_INVITES:
      return { ...state, invites: action.payload, loading: false, lastUpdated: new Date() };
    case GroupsActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case GroupsActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    case GroupsActionTypes.SET_ATTENDANCE:
      return { ...state, attendance: action.payload };
    case GroupsActionTypes.ADD_GROUP:
      return { 
        ...state, 
        groups: [action.payload, ...state.groups],
        lastUpdated: new Date()
      };
    case GroupsActionTypes.UPDATE_GROUP:
      return { 
        ...state, 
        groups: state.groups.map(group => 
          group.id === action.payload.id ? action.payload : group
        ),
        currentGroup: state.currentGroup?.id === action.payload.id ? action.payload : state.currentGroup,
        lastUpdated: new Date()
      };
    case GroupsActionTypes.REMOVE_GROUP:
      return { 
        ...state, 
        groups: state.groups.filter(group => group.id !== action.payload),
        currentGroup: state.currentGroup?.id === action.payload ? null : state.currentGroup,
        lastUpdated: new Date()
      };
    case GroupsActionTypes.ADD_INVITE:
      return { 
        ...state, 
        invites: [action.payload, ...state.invites],
        lastUpdated: new Date()
      };
    case GroupsActionTypes.REMOVE_INVITE:
      return { 
        ...state, 
        invites: state.invites.filter(invite => invite.id !== action.payload),
        lastUpdated: new Date()
      };
    case GroupsActionTypes.RESET_STATE:
      return initialState;
    default:
      return state;
  }
}

// Create context
const GroupsContext = createContext(null);

// Provider component
export function GroupsProvider({ children }) {
  const [state, dispatch] = useReducer(groupsReducer, initialState);
  const { user } = useAuth();

  // Reset state when user logs out
  React.useEffect(() => {
    if (!user) {
      // Clean up attendance subscription
      if (state.attendanceUnsubscribe) {
        state.attendanceUnsubscribe();
      }
      dispatch({ type: GroupsActionTypes.RESET_STATE });
    }
  }, [user, state.attendanceUnsubscribe]);

  // Load user groups
  const loadUserGroups = useCallback(async () => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });
    
    try {
      const userGroupsList = await groupsService.getUserGroups(user.uid);
      dispatch({
        type: GroupsActionTypes.SET_GROUPS,
        payload: userGroupsList
      });
    } catch (error) {
      console.error('Error loading user groups:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
    }
  }, [user]);

  // Load specific group
  const loadGroupAction = useCallback(async (groupId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      const groupData = await groupsService.getGroup(groupId);
      
      dispatch({
        type: GroupsActionTypes.SET_CURRENT_GROUP,
        payload: groupData
      });
      
      // Also load group members
      await loadGroupMembers(groupId);
    } catch (error) {
      console.error(`Error loading group ${groupId}:`, error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
    }
  }, [user]);

  // Load group members
  const loadGroupMembers = useCallback(async (groupId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return;
    }

    try {
      const members = await groupsService.getGroupMembers(groupId, user.uid);
      
      dispatch({
        type: GroupsActionTypes.SET_CURRENT_GROUP_MEMBERS,
        payload: members
      });
    } catch (error) {
      console.error(`Error loading members for group ${groupId}:`, error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
    }
  }, [user]);

  // Create new group
  const createNewGroup = useCallback(async (groupData, memberIds = [], customAddresses = []) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return null;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      // Convert memberIds array to initialMembers format
      const initialMembers = memberIds.map(userId => ({
        user_id: userId
      }));

      const newGroup = await groupsService.createGroup(user.uid, groupData, initialMembers);
      
      // Add custom addresses to the group if any
      if (customAddresses.length > 0) {
        for (const address of customAddresses) {
          try {
            await groupsService.addCustomLocationToGroup(newGroup.id, address, user.uid);
          } catch (error) {
            console.error('❌ Failed to add custom address:', address.address, error);
          }
        }
        
        // Load group members to include the new custom locations
        try {
          await loadGroupMembers(newGroup.id);
        } catch (error) {
          console.warn('Failed to reload group members:', error);
        }
      }
      
      dispatch({
        type: GroupsActionTypes.ADD_GROUP,
        payload: newGroup
      });
      
      dispatch({
        type: GroupsActionTypes.SET_CURRENT_GROUP,
        payload: newGroup
      });
      
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return null;
    }
  }, [user]);

  // Update group info
  const updateGroupInfo = useCallback(async (groupId, updateData) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      const updatedGroup = await groupsService.updateGroup(groupId, updateData, user.uid);
      
      dispatch({
        type: GroupsActionTypes.UPDATE_GROUP,
        payload: updatedGroup
      });
      
      return true;
    } catch (error) {
      console.error(`Error updating group ${groupId}:`, error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user]);

  // Load group invites - placeholder implementation
  const loadGroupInvites = useCallback(async () => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      // TODO: Implement group invites loading logic
      console.log('Loading group invites for user:', user.uid);
      
      // Placeholder invites
      dispatch({
        type: GroupsActionTypes.SET_INVITES,
        payload: []
      });
    } catch (error) {
      console.error('Error loading group invites:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
    }
  }, [user]);

  // Accept group invite - placeholder implementation
  const acceptInvite = useCallback(async (inviteId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      // TODO: Implement accept invite logic
      console.log('Accepting group invite:', inviteId);
      
      // Remove invite from list
      dispatch({
        type: GroupsActionTypes.REMOVE_INVITE,
        payload: inviteId
      });
      
      // Reload groups to show new group
      await loadUserGroups();
      
      return true;
    } catch (error) {
      console.error('Error accepting group invite:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadUserGroups]);

  // Decline group invite - placeholder implementation
  const declineInvite = useCallback(async (inviteId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      // TODO: Implement decline invite logic
      console.log('Declining group invite:', inviteId);
      
      // Remove invite from list
      dispatch({
        type: GroupsActionTypes.REMOVE_INVITE,
        payload: inviteId
      });
      
      return true;
    } catch (error) {
      console.error('Error declining group invite:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user]);

  // Update attendance for any user (requires user ID)
  const updateUserAttendance = useCallback(async (groupId, userId, isAttending, location = null) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      await groupsService.updateAttendance(groupId, userId, isAttending, location);
      
      // Reload group members to get updated attendance data
      await loadGroupMembers(groupId);
      
      return true;
    } catch (error) {
      console.error('Error updating user attendance:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadGroupMembers]);

  // Update attendance for current user (convenience function)
  const updateMyAttendance = useCallback(async (groupId, isAttending, location = null) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    return updateUserAttendance(groupId, user.uid, isAttending, location);
  }, [user, updateUserAttendance]);

  // Get current user's attendance for a group
  const getMyAttendance = useCallback(async (groupId) => {
    if (!user) return null;

    try {
      return await groupsService.getUserAttendance(groupId, user.uid);
    } catch (error) {
      console.error('Error getting attendance:', error);
      return null;
    }
  }, [user]);

  // Reset all attendance for a group (admin only)
  const resetGroupAttendance = useCallback(async (groupId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      await groupsService.resetGroupAttendance(groupId, user.uid);
      
      // Reload group members to get updated attendance data
      await loadGroupMembers(groupId);
      
      return true;
    } catch (error) {
      console.error('Error resetting group attendance:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadGroupMembers]);

  // Search for users to add to group
  const searchUsers = useCallback(async (searchTerm) => {
    if (!user) {
      return [];
    }

    try {
      return await groupsService.searchUsers(searchTerm, user.uid);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }, [user]);

  // Find users by phone numbers (for contact import)
  const findUsersByPhoneNumbers = useCallback(async (phoneNumbers) => {
    try {
      return await groupsService.findUsersByPhoneNumbers(phoneNumbers);
    } catch (error) {
      console.error('Error finding users by phone numbers:', error);
      return [];
    }
  }, []);

  // Get addresses for group members
  const getGroupMemberAddresses = useCallback(async (groupId) => {
    if (!user) return {};
    
    try {
      return await groupsService.getGroupMemberAddresses(groupId, user.uid);
    } catch (error) {
      console.error('Error getting group member addresses:', error);
      return {};
    }
  }, [user]);

  // Get user addresses by user IDs (fallback)
  const getUserAddresses = useCallback(async (userIds) => {
    try {
      return await groupsService.getUserAddresses(userIds);
    } catch (error) {
      console.error('Error getting user addresses:', error);
      return {};
    }
  }, []);

  // Add member to group
  const addGroupMember = useCallback(async (groupId, userId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      await groupsService.addGroupMember(groupId, userId, user.uid);
      // Reload group members
      await loadGroupMembers(groupId);
      return true;
    } catch (error) {
      console.error('Error adding group member:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadGroupMembers]);

  // Remove member from group
  const removeGroupMember = useCallback(async (groupId, userId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      await groupsService.removeGroupMember(groupId, userId, user.uid);
      // Reload group members
      await loadGroupMembers(groupId);
      return true;
    } catch (error) {
      console.error('Error removing group member:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, loadGroupMembers]);

  // Add custom location to group
  const addCustomLocationToGroup = useCallback(async (groupId, location) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      const result = await groupsService.addCustomLocationToGroup(groupId, location, user.uid);
      console.log('✅ Custom location added to group:', result);
      return result;
    } catch (error) {
      console.error('Error adding custom location to group:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return null;
    }
  }, [user]);

  // Get custom locations for group
  const getGroupCustomLocations = useCallback(async (groupId) => {
    try {
      return await groupsService.getGroupCustomLocations(groupId);
    } catch (error) {
      console.error('Error getting group custom locations:', error);
      return [];
    }
  }, []);

  // Update custom location attendance
  const updateCustomLocationAttendance = useCallback(async (locationId, isAttending) => {
    try {
      return await groupsService.updateCustomLocationAttendance(locationId, isAttending);
    } catch (error) {
      console.error('Error updating custom location attendance:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, []);

  // Remove custom location from group
  const removeCustomLocationFromGroup = useCallback(async (locationId) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      await groupsService.removeCustomLocationFromGroup(locationId, user.uid);
      return true;
    } catch (error) {
      console.error('Error removing custom location from group:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: GroupsActionTypes.CLEAR_ERROR });
  }, []);

  const value = {
    // State
    ...state,
    
    // Actions
    loadUserGroups,
    loadGroup: loadGroupAction,
    loadGroupMembers,
    createNewGroup,
    updateGroupInfo,
    loadGroupInvites,
    acceptInvite,
    declineInvite,
    updateMyAttendance,
    updateUserAttendance,
    getMyAttendance,
    resetGroupAttendance,
    searchUsers,
    findUsersByPhoneNumbers,
    getUserAddresses,
    getGroupMemberAddresses,
    addGroupMember,
    removeGroupMember,
    addCustomLocationToGroup,
    getGroupCustomLocations,
    updateCustomLocationAttendance,
    removeCustomLocationFromGroup,
    clearError
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
}

// Hook to use groups context
export function useGroups() {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}

export default GroupsContext; 