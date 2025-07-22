import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { groupsService } from '../services/groupsService';

const GroupAttendanceContext = createContext(null);

export function GroupAttendanceProvider({ children }) {
  const [attendanceByGroup, setAttendanceByGroup] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setAttendanceByGroup(new Map());
      setError(null);
    }
  }, [user]);

  const actions = useMemo(() => {
    const updateUserAttendance = async (groupId, userId, isAttending, location = null) => {
      if (!user || !groupId) return false;

      setLoading(true);
      setError(null);

      try {
        await groupsService.updateAttendance(groupId, userId, isAttending, location);
        
        // Update local state
        setAttendanceByGroup(prev => {
          const newMap = new Map(prev);
          const groupAttendance = newMap.get(groupId) || new Map();
          groupAttendance.set(userId, {
            isAttending,
            location,
            confirmedAt: new Date().toISOString()
          });
          newMap.set(groupId, groupAttendance);
          return newMap;
        });

        return true;
      } catch (error) {
        console.error('Error updating attendance:', error);
        setError(error.message);
        return false;
      } finally {
        setLoading(false);
      }
    };

    const updateMyAttendance = async (groupId, isAttending, location = null) => {
      if (!user) return false;
      return updateUserAttendance(groupId, user.uid, isAttending, location);
    };

    const getMyAttendance = async (groupId) => {
      if (!user || !groupId) return null;

      try {
        return await groupsService.getUserAttendance(groupId, user.uid);
      } catch (error) {
        console.error('Error getting attendance:', error);
        return null;
      }
    };

    const resetGroupAttendance = async (groupId) => {
      if (!user || !groupId) return false;

      try {
        await groupsService.resetGroupAttendance(groupId, user.uid);
        
        // Clear local attendance for this group
        setAttendanceByGroup(prev => {
          const newMap = new Map(prev);
          newMap.delete(groupId);
          return newMap;
        });

        return true;
      } catch (error) {
        console.error('Error resetting group attendance:', error);
        setError(error.message);
        return false;
      }
    };

    const updateCustomLocationAttendance = async (locationId, isAttending) => {
      setLoading(true);
      setError(null);
      try {
        await groupsService.updateCustomLocationAttendance(locationId, isAttending);
        return true;
      } catch (error) {
        console.error('Error updating custom location attendance:', error);
        setError(error.message);
        return false;
      } finally {
        setLoading(false);
      }
    };

    const clearError = () => setError(null);

    return {
      updateUserAttendance,
      updateMyAttendance,
      getMyAttendance,
      resetGroupAttendance,
      updateCustomLocationAttendance,
      clearError
    };
  }, [user]);

  const getGroupAttendance = useMemo(() => (groupId) => {
    return attendanceByGroup.get(groupId) || new Map();
  }, [attendanceByGroup]);

  const contextValue = useMemo(() => ({
    attendanceByGroup,
    loading,
    error,
    getGroupAttendance,
    ...actions
  }), [attendanceByGroup, loading, error, getGroupAttendance, actions]);

  return (
    <GroupAttendanceContext.Provider value={contextValue}>
      {children}
    </GroupAttendanceContext.Provider>
  );
}

export const useGroupAttendance = () => {
  const context = useContext(GroupAttendanceContext);
  if (!context) {
    throw new Error('useGroupAttendance must be used within a GroupAttendanceProvider');
  }
  return context;
};
