import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Capacitor-specific Firebase Auth initialization
function whichAuth() {
  let auth;
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
    console.log('Initializing Firebase Auth for Capacitor native platform');
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });
  } else {
    console.log('Initializing Firebase Auth for web platform');
    auth = getAuth(app);
  }
  return auth;
}

export const auth = whichAuth();

// Set persistence - only for web, Capacitor handles its own persistence
if (typeof window !== 'undefined' && (!window.Capacitor || !window.Capacitor.isNativePlatform())) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('Failed to set auth persistence:', error);
  });
} else if (typeof window !== 'undefined' && window.Capacitor) {
  console.log('Capacitor environment detected - using indexedDB persistence');
}

export const db = getFirestore(app);
export const functions = getFunctions(app);







