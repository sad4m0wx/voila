import React from 'react';
import { GroupsProvider } from './GroupsContext';
import { GroupMembersProvider } from './GroupMembersContext';
import { GroupAttendanceProvider } from './GroupAttendanceContext';

export function GroupsCompositeProvider({ children }) {
  return (
    <GroupsProvider>
      <GroupMembersProvider>
        <GroupAttendanceProvider>
          {children}
        </GroupAttendanceProvider>
      </GroupMembersProvider>
    </GroupsProvider>
  );
}
