import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

/**
 * Create a user profile in Firestore
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Object} data - User data
 */
export async function createUserProfile(db, userId, data) {
  const userRef = doc(db, 'users', userId);
  
  await setDoc(userRef, {
    displayName: data.displayName || '',
    displayNameLower: (data.displayName || '').toLowerCase(),
    email: data.email || '',
    phoneNumber: data.phoneNumber || '',
    photoURL: data.photoURL || '',
    homeAddress: data.homeAddress || null,
    savedAddresses: data.savedAddresses || [],
    friends: data.friends || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return userRef;
}

/**
 * Get a user profile
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 */
export async function getUserProfile(db, userId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return { id: userSnap.id, ...userSnap.data() };
  }
  
  return null;
}

/**
 * Subscribe to a user profile for real-time updates
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function that receives the user data
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToUserProfile(db, userId, callback) {
  if (!userId) return () => {};
  
  const userRef = doc(db, 'users', userId);
  
  return onSnapshot(
    userRef,
    (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("Error subscribing to user profile:", error);
      callback(null, error);
    }
  );
}

/**
 * Update a user profile
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Object} data - User data to update
 */
export async function updateUserProfile(db, userId, data) {
  const userRef = doc(db, 'users', userId);
  
  // Make sure we're not trying to update timestamps or protected fields
  const safeData = { ...data };
  delete safeData.createdAt;
  delete safeData.id;
  
  // Update displayNameLower if displayName is being updated
  if (safeData.displayName) {
    safeData.displayNameLower = safeData.displayName.toLowerCase();
  }
  
  await updateDoc(userRef, {
    ...safeData,
    updatedAt: serverTimestamp()
  });
  
  return userRef;
}

/**
 * Save an address for a user
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Object} address - Address object
 */
export async function saveAddress(db, userId, address) {
  const userRef = doc(db, 'users', userId);
  
  // Ensure the address has a unique ID
  if (!address.id) {
    address.id = Math.random().toString(36).substring(2, 15);
  }
  
  // Add created timestamp
  address.createdAt = serverTimestamp();
  
  await updateDoc(userRef, {
    savedAddresses: arrayUnion(address),
    updatedAt: serverTimestamp()
  });
  
  return address;
}

/**
 * Update a saved address
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Object} updatedAddress - Updated address object (must have id)
 */
export async function updateAddress(db, userId, updatedAddress) {
  if (!updatedAddress.id) {
    throw new Error('Address ID is required for updating');
  }
  
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    throw new Error('User not found');
  }
  
  const userData = userSnap.data();
  const addresses = userData.savedAddresses || [];
  
  // Find and update the address
  const updatedAddresses = addresses.map(addr => 
    addr.id === updatedAddress.id ? { ...addr, ...updatedAddress, updatedAt: new Date() } : addr
  );
  
  await updateDoc(userRef, {
    savedAddresses: updatedAddresses,
    updatedAt: serverTimestamp()
  });
  
  return updatedAddress;
}

/**
 * Remove a saved address
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Object} address - Address object
 */
export async function removeAddress(db, userId, address) {
  const userRef = doc(db, 'users', userId);
  
  await updateDoc(userRef, {
    savedAddresses: arrayRemove(address),
    updatedAt: serverTimestamp()
  });
  
  return userRef;
}

/**
 * Set home address
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {Object} address - Address object
 */
export async function setHomeAddress(db, userId, address) {
  const userRef = doc(db, 'users', userId);
  
  await updateDoc(userRef, {
    homeAddress: address,
    updatedAt: serverTimestamp()
  });
  
  return userRef;
} 