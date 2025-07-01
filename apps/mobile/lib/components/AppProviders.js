import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { GroupsProvider } from '../contexts/GroupsContext';

const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
        <GroupsProvider>
          {children}
        </GroupsProvider>
    </AuthProvider>
  );
};

export default AppProviders; 