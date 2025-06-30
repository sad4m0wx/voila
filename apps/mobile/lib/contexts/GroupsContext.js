import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { db } from '../firebase-auth/config';
import { useAuth } from './AuthContext';
import {
  createGroup,
  getGroup,
  getUserGroups,
  getGroupMembers,
  updateGroup,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  subscribeToGroup,
  subscribeToGroupMembers
} from '../firebase-auth/groups';

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
      const userGroupsList = await getUserGroups(db, user.uid);
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
      const groupData = await getGroup(db, groupId);
      
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
      const members = await getGroupMembers(db, groupId, user.uid);
      
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
  const createNewGroup = useCallback(async (groupData, initialMembers = []) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return null;
    }

    dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

    try {
      const newGroup = await createGroup(db, user.uid, groupData, initialMembers);
      
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

  // Update group info - placeholder implementation
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
      // TODO: Implement group update logic
      console.log('Updating group:', groupId, 'with data:', updateData);
      
      // Placeholder updated group
      const updatedGroup = {
        ...state.currentGroup,
        ...updateData,
        updatedAt: new Date()
      };
      
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
  }, [user, state.currentGroup]);

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

  // Update attendance - placeholder implementation
  const updateMyAttendance = useCallback(async (groupId, isAttending, location = null) => {
    if (!user) {
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: 'User not authenticated'
      });
      return false;
    }

    try {
      // TODO: Implement attendance update logic
      console.log('Updating attendance for group:', groupId, 'attending:', isAttending, 'location:', location);
      
      // Update local attendance state
      const newAttendance = new Map(state.attendance);
      newAttendance.set(user.uid, {
        isAttending,
        updatedAt: new Date(),
        location
      });
      
      dispatch({
        type: GroupsActionTypes.SET_ATTENDANCE,
        payload: newAttendance
      });
      
      return true;
    } catch (error) {
      console.error('Error updating attendance:', error);
      dispatch({
        type: GroupsActionTypes.SET_ERROR,
        payload: error.message
      });
      return false;
    }
  }, [user, state.attendance]);

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