// backend/firebase/functions/index.js
const userFunctions = require('./src/users');
const friendFunctions = require('./src/friends');
const groupFunctions = require('./src/groups');

// Export all user-related functions
exports.createUserProfile = userFunctions.createUserProfile;
exports.findUserByEmail = userFunctions.findUserByEmail;
exports.sendFriendRequest = userFunctions.sendFriendRequest;
exports.acceptFriendRequest = userFunctions.acceptFriendRequest;
exports.createGroup = userFunctions.createGroup;
exports.getFriendsWithProfiles = userFunctions.getFriendsWithProfiles;

// Export all friend-related functions
exports.onFriendRequestCreated = friendFunctions.onFriendRequestCreated;
exports.onFriendRequestUpdated = friendFunctions.onFriendRequestUpdated;
exports.onUserDeleted = friendFunctions.onUserDeleted;

// Export all group-related functions
exports.onGroupCreated = groupFunctions.onGroupCreated;
exports.onGroupInviteCreated = groupFunctions.onGroupInviteCreated;
exports.onGroupInviteUpdated = groupFunctions.onGroupInviteUpdated;
exports.onGroupMemberAdded = groupFunctions.onGroupMemberAdded;
exports.cleanupExpiredInvites = groupFunctions.cleanupExpiredInvites;
exports.cleanupUserGroups = groupFunctions.cleanupUserGroups;