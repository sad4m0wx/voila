// Export contexts
export { default as AuthContext, AuthProvider, useAuth } from './AuthContext';
export { default as FriendsContext, FriendsProvider, useFriends } from './FriendsContext';
export { default as GroupsContext, GroupsProvider, useGroups } from './GroupsContext';

// Re-export for convenience
export { default as AppProviders } from '../components/AppProviders'; 