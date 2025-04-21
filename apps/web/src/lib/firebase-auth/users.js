
// ===============================
// shared/firebase-auth/users.js
// ===============================
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
    serverTimestamp
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
      email: data.email || '',
      photoURL: data.photoURL || '',
      homeAddress: data.homeAddress || null,
      savedAddresses: data.savedAddresses || [],
      friends: data.friends || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isAnonymous: data.isAnonymous || false
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
   * Update a user profile
   * @param {Object} db - Firestore instance
   * @param {string} userId - User ID
   * @param {Object} data - User data to update
   */
  export async function updateUserProfile(db, userId, data) {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      ...data,
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
    
    await updateDoc(userRef, {
      savedAddresses: arrayUnion(address),
      updatedAt: serverTimestamp()
    });
    
    return userRef;
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