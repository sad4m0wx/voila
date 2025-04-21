import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  onAuthStateChanged,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

/**
 * Sign in with email and password
 * @param {Object} auth - Firebase auth instance
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function signIn(auth, email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

/**
 * Create a new user account
 * @param {Object} auth - Firebase auth instance
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name
 */
export async function signUp(auth, email, password, displayName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Add display name
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    // Send verification email
    await sendEmailVerification(userCredential.user);
    
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

/**
 * Sign out the current user
 * @param {Object} auth - Firebase auth instance
 */
export async function signOut(auth) {
  try {
    await firebaseSignOut(auth);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 * @param {Object} auth - Firebase auth instance
 * @param {string} email - User email
 */
export async function resetPassword(auth, email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}




/**
 * Sign in anonymously (as guest)
 * @param {Object} auth - Firebase auth instance
 */
export async function signInAsGuest(auth) {
  try {
    const userCredential = await signInAnonymously(auth);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

/**
 * Convert anonymous account to permanent account
 * @param {Object} auth - Firebase auth instance
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function convertAnonymousAccount(auth, email, password) {
  try {
    const user = auth.currentUser;
    
    if (!user || !user.isAnonymous) {
      throw new Error('No anonymous user signed in');
    }
    
    const credential = EmailAuthProvider.credential(email, password);
    const userCredential = await linkWithCredential(user, credential);
    
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

/**
 * Subscribe to auth state changes
 * @param {Object} auth - Firebase auth instance
 * @param {Function} callback - Callback function
 */
export function subscribeToAuthChanges(auth, callback) {
  return onAuthStateChanged(auth, callback);
}
