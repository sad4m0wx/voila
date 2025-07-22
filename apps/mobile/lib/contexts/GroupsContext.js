import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { groupsService } from '../services/groupsService';

const initialGroupsState = {
  groups: [],
  currentGroup: null,
  loading: false,
  error: null,
  lastUpdated: null
};

const GroupsActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_GROUPS: 'SET_GROUPS',
  SET_CURRENT_GROUP: 'SET_CURRENT_GROUP',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  ADD_GROUP: 'ADD_GROUP',
  UPDATE_GROUP: 'UPDATE_GROUP',
  REMOVE_GROUP: 'REMOVE_GROUP',
  RESET_STATE: 'RESET_STATE'
};

function groupsReducer(state, action) {
  switch (action.type) {
    case GroupsActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case GroupsActionTypes.SET_GROUPS:
      return { 
        ...state, 
        groups: action.payload, 
        loading: false, 
        lastUpdated: new Date() 
      };
    
    case GroupsActionTypes.SET_CURRENT_GROUP:
      return { ...state, currentGroup: action.payload, loading: false };
    
    case GroupsActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case GroupsActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    
    case GroupsActionTypes.ADD_GROUP:
      return { 
        ...state, 
        groups: [action.payload, ...state.groups],
        lastUpdated: new Date()
      };
    
    case GroupsActionTypes.UPDATE_GROUP:
      if (!action.payload?.id) return state;
      return { 
        ...state, 
        groups: state.groups.map(group => 
          group?.id === action.payload.id ? action.payload : group
        ),
        currentGroup: state.currentGroup?.id === action.payload.id 
          ? action.payload 
          : state.currentGroup,
        lastUpdated: new Date()
      };
    
    case GroupsActionTypes.REMOVE_GROUP:
      if (!action.payload) return state;
      return { 
        ...state, 
        groups: state.groups.filter(group => group?.id !== action.payload),
        currentGroup: state.currentGroup?.id === action.payload 
          ? null 
          : state.currentGroup,
        lastUpdated: new Date()
      };
    
    case GroupsActionTypes.RESET_STATE:
      return initialGroupsState;
    
    default:
      return state;
  }
}

const GroupsContext = createContext(null);

export function GroupsProvider({ children }) {
  const [state, dispatch] = useReducer(groupsReducer, initialGroupsState);
  const { user } = useAuth();

  // Reset state when user logs out
  useEffect(() => {
    if (!user) {
      dispatch({ type: GroupsActionTypes.RESET_STATE });
    }
  }, [user]);

  // Actions - memoized to prevent unnecessary re-renders
  const actions = useMemo(() => {
    const loadUserGroups = async () => {
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
    };

    const loadGroup = async (groupId) => {
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
      } catch (error) {
        console.error(`Error loading group ${groupId}:`, error);
        dispatch({ 
          type: GroupsActionTypes.SET_ERROR, 
          payload: error.message 
        });
      }
    };

    const createGroup = async (groupData, memberIds = [], customAddresses = []) => {
      if (!user) {
        dispatch({ 
          type: GroupsActionTypes.SET_ERROR, 
          payload: 'User not authenticated' 
        });
        return null;
      }

      dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

      try {
        const initialMembers = memberIds.map(userId => ({ user_id: userId }));
        const newGroup = await groupsService.createGroup(
          user.uid, 
          groupData, 
          initialMembers
        );
        
        if (newGroup?.id) {
          // Handle custom addresses if any
          if (customAddresses.length > 0) {
            await Promise.allSettled(
              customAddresses.map(address => 
                groupsService.addCustomLocationToGroup(newGroup.id, address, user.uid)
              )
            );
          }

          dispatch({ type: GroupsActionTypes.ADD_GROUP, payload: newGroup });
          dispatch({ type: GroupsActionTypes.SET_CURRENT_GROUP, payload: newGroup });
        }
        
        return newGroup;
      } catch (error) {
        console.error('Error creating group:', error);
        dispatch({ 
          type: GroupsActionTypes.SET_ERROR, 
          payload: error.message 
        });
        return null;
      }
    };

    const updateGroup = async (groupId, updateData) => {
      if (!user) return false;

      dispatch({ type: GroupsActionTypes.SET_LOADING, payload: true });

      try {
        const updatedGroup = await groupsService.updateGroup(
          groupId, 
          updateData, 
          user.uid
        );
        
        if (updatedGroup) {
          dispatch({ 
            type: GroupsActionTypes.UPDATE_GROUP, 
            payload: updatedGroup 
          });
        }
        
        return true;
      } catch (error) {
        console.error(`Error updating group ${groupId}:`, error);
        dispatch({ 
          type: GroupsActionTypes.SET_ERROR, 
          payload: error.message 
        });
        return false;
      }
    };

    const deleteGroup = async (groupId) => {
      if (!user) return false;

      try {
        await groupsService.deleteGroup(groupId, user.uid);
        dispatch({ type: GroupsActionTypes.REMOVE_GROUP, payload: groupId });
        return true;
      } catch (error) {
        console.error('Error deleting group:', error);
        dispatch({ 
          type: GroupsActionTypes.SET_ERROR, 
          payload: error.message 
        });
        return false;
      }
    };

    const clearError = () => {
      dispatch({ type: GroupsActionTypes.CLEAR_ERROR });
    };

    const findUsersByPhoneNumbers = async (phoneNumbers) => {
      return groupsService.findUsersByPhoneNumbers(phoneNumbers);
    };

    const getUserAddresses = async (userIds) => {
      return groupsService.getUserAddresses(userIds);
    };

    return {
      loadUserGroups,
      loadGroup,
      createGroup,
      updateGroup,
      deleteGroup,
      clearError,
      findUsersByPhoneNumbers,
      getUserAddresses
    };
  }, [user]); // Only re-create when user changes

  // Split value creation for better performance
  const contextValue = useMemo(() => ({
    ...state,
    ...actions
  }), [state, actions]);

  return (
    <GroupsContext.Provider value={contextValue}>
      {children}
    </GroupsContext.Provider>
  );
}

export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
};
