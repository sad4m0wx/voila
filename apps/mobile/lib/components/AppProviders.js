import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { GroupsProvider } from '../contexts/GroupsContext';
import { useAppInitialization } from '../hooks/useAppInitialization';

const AppInitializer = ({ children }) => {
  useAppInitialization();
  return children;
};

const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      <GroupsProvider>
        <AppInitializer>
          {children}
        </AppInitializer>
      </GroupsProvider>
    </AuthProvider>
  );
};

export default AppProviders; 