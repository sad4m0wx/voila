// backend/firebase/functions/index.js
const userFunctions = require('./src/users');

// Export all user-related functions
exports.createUserProfile = userFunctions.createUserProfile;
exports.findUserByEmail = userFunctions.findUserByEmail;
exports.sendFriendRequest = userFunctions.sendFriendRequest;
exports.acceptFriendRequest = userFunctions.acceptFriendRequest;
exports.createGroup = userFunctions.createGroup;
exports.getFriendsWithProfiles = userFunctions.getFriendsWithProfiles;