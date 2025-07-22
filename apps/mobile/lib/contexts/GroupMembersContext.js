import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { groupsService } from '../services/groupsService';

const initialMembersState = {
  membersByGroup: new Map(), // groupId -> members array
  loading: false,
  error: null
};

const MembersActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_MEMBERS: 'SET_MEMBERS',
  ADD_MEMBER: 'ADD_MEMBER',
  REMOVE_MEMBER: 'REMOVE_MEMBER',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET_STATE: 'RESET_STATE'
};

function membersReducer(state, action) {
  switch (action.type) {
    case MembersActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case MembersActionTypes.SET_MEMBERS:
      const newMembersByGroup = new Map(state.membersByGroup);
      newMembersByGroup.set(action.payload.groupId, action.payload.members);
      return { 
        ...state, 
        membersByGroup: newMembersByGroup, 
        loading: false 
      };
    
    case MembersActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case MembersActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    
    case MembersActionTypes.RESET_STATE:
      return initialMembersState;
    
    default:
      return state;
  }
}

const GroupMembersContext = createContext(null);

export function GroupMembersProvider({ children }) {
  const [state, dispatch] = useReducer(membersReducer, initialMembersState);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      dispatch({ type: MembersActionTypes.RESET_STATE });
    }
  }, [user]);

  const actions = useMemo(() => {
    const loadGroupMembers = async (groupId) => {
      if (!user || !groupId) return;

      dispatch({ type: MembersActionTypes.SET_LOADING, payload: true });

      try {
        const members = await groupsService.getGroupMembers(groupId, user.uid);
        dispatch({ 
          type: MembersActionTypes.SET_MEMBERS, 
          payload: { groupId, members } 
        });
      } catch (error) {
        console.error(`Error loading members for group ${groupId}:`, error);
        dispatch({ 
          type: MembersActionTypes.SET_ERROR, 
          payload: error.message 
        });
      }
    };

    const addGroupMember = async (groupId, userId) => {
      if (!user || !groupId) return false;

      try {
        await groupsService.addGroupMember(groupId, userId, user.uid);
        // Reload members after successful add
        await loadGroupMembers(groupId);
        return true;
      } catch (error) {
        console.error('Error adding group member:', error);
        dispatch({ 
          type: MembersActionTypes.SET_ERROR, 
          payload: error.message 
        });
        return false;
      }
    };

    const removeGroupMember = async (groupId, userId) => {
      if (!user || !groupId) return false;

      try {
        await groupsService.removeGroupMember(groupId, userId, user.uid);
        // Reload members after successful removal
        await loadGroupMembers(groupId);
        return true;
      } catch (error) {
        console.error('Error removing group member:', error);
        dispatch({ 
          type: MembersActionTypes.SET_ERROR, 
          payload: error.message 
        });
        return false;
      }
    };

    const clearError = () => {
      dispatch({ type: MembersActionTypes.CLEAR_ERROR });
    };

    return {
      loadGroupMembers,
      addGroupMember,
      removeGroupMember,
      clearError
    };
  }, [user]);

  // Helper to get members for a specific group
  const getGroupMembers = useMemo(() => (groupId) => {
    return state.membersByGroup.get(groupId) || [];
  }, [state.membersByGroup]);

  const contextValue = useMemo(() => ({
    ...state,
    getGroupMembers,
    ...actions
  }), [state, getGroupMembers, actions]);

  return (
    <GroupMembersContext.Provider value={contextValue}>
      {children}
    </GroupMembersContext.Provider>
  );
}

export const useGroupMembers = () => {
  const context = useContext(GroupMembersContext);
  if (!context) {
    throw new Error('useGroupMembers must be used within a GroupMembersProvider');
  }
  return context;
};
